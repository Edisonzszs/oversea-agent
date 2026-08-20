/**
 * orch · run-engine（2c）
 * ============================================================
 * 服务端运行编排：runOrchestration（shared，注入服务端 planner/registry/aggregate）
 * → 每个编排事件 INSERT agent_events（事实源）→ 按事件类型更新投影
 * （agent_runs / agent_tasks / messages）→ SSE 广播给订阅该 run 的连接。
 *
 * 投影纪律：只准从事件写（recordEvent 单点映射），禁止旁路直写。
 * 自定义事件 run.final（携最终 output）用于：浏览器取最终正文 + 落 assistant 消息投影。
 * 取消 = 进程内 AbortController 映射；重试复用 shared orchestrator 的 runtimeExecutions。
 */
import { randomUUID } from "node:crypto";
import { runOrchestration, retryOrchestrationTask } from "../../shared/orchestration/orchestrator";
import { createExecutionPlan } from "../../shared/orchestration/planner";
import { aggregateResults } from "../../shared/orchestration/aggregator";
import type { OrchestrationEvent } from "../../shared/orchestration/types";
import { ORCHESTRATOR_PLANNER_PROMPT, ORCHESTRATOR_AGGREGATION_PROMPT } from "../../app/prompts/systemPrompts";
import { serverJsonComplete, serverStreamChat } from "./llm";
import { createServerRegistry } from "./adapters";
import type { Db } from "./db";

export interface StartRunInput {
  question: string;
  convId?: string;
  userKey?: string;
  conversation: Array<{ role: string; content: string }>;
  profileBlock?: string;
}

export interface StartRunResult {
  runId: string;
  convId: string;
}

type Subscriber = (event: OrchestrationEvent & { seq: number }) => void;

export class RunEngine {
  private sseBus = new Map<string, Set<Subscriber>>();
  private controllers = new Map<string, AbortController>();
  /** 每 run 事件落库串行链：emit 同步触发、recordEvent 异步执行，不串行会抢 seq 乱序 */
  private eventQueues = new Map<string, Promise<void>>();

  constructor(private db: Db) {}

  /** 事件按发射顺序落库+广播（前一个 recordEvent 完成后才执行下一个）。 */
  private enqueueEvent(runId: string, convId: string, event: OrchestrationEvent): Promise<void> {
    const prev = this.eventQueues.get(runId) ?? Promise.resolve();
    const next = prev.then(() => this.recordEvent(runId, convId, event)).catch(() => undefined);
    this.eventQueues.set(runId, next);
    return next;
  }

  /** 持久入队：建会话/写用户消息 → 立即返回 runId，执行异步进行（dsh 口径）。 */
  async startRun(input: StartRunInput): Promise<StartRunResult> {
    const question = input.question.trim();
    if (!question) throw new Error("question 不能为空");

    const convId = input.convId?.trim() || `c-${randomUUID().slice(0, 8)}`;
    const userKey = input.userKey?.trim() || "anon";
    // 会话不存在则建（R1：profile_block 会话创建时冻结）
    await this.db.query(
      `INSERT INTO conversations (id, user_key, title, profile_block)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [convId, userKey, question.slice(0, 40), input.profileBlock ?? null],
    );
    await this.db.query(
      `UPDATE conversations SET updated_at = now() WHERE id = $1`, [convId],
    );
    // 用户消息投影（seq 单调递增）
    await this.db.query(
      `INSERT INTO messages (conv_id, seq, role, content, meta)
       VALUES ($1, (SELECT COALESCE(MAX(seq),0)+1 FROM messages WHERE conv_id = $1), 'user', $2, $3)`,
      [convId, question, JSON.stringify({})],
    );

    const runId = `run-${randomUUID().slice(0, 8)}`;
    await this.db.query(
      `INSERT INTO agent_runs (id, conv_id, question, status) VALUES ($1, $2, $3, 'planning')`,
      [runId, convId, question],
    );

    // 异步执行（事件先落库，断线可回放）；但 POST 回执等 run.started 落库后再返回，
    // 消除"客户端订阅时首事件尚未落库、回放错过 run.started"的竞态（浏览器 reducer 依赖它建态）。
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    let firstEvent = true;
    void this.executeRun(runId, convId, question, input.conversation, (event) => {
      const recorded = this.enqueueEvent(runId, convId, event);
      if (firstEvent) {
        firstEvent = false;
        void recorded.then(signalStarted, signalStarted);
      }
      return recorded;
    });
    await started;
    return { runId, convId };
  }

  private async executeRun(
    runId: string,
    convId: string,
    question: string,
    conversation: Array<{ role: string; content: string }>,
    onEvent?: (event: OrchestrationEvent) => Promise<void> | void,
  ): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    let failureRecorded = false; // runOrchestration 已发 run.failed 则兜底不重记
    try {
      const { output } = await runOrchestration({
        question,
        messageId: runId,
        conversation,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "run.failed") failureRecorded = true;
          if (onEvent) return onEvent(event);
          void this.enqueueEvent(runId, convId, event);
        },
        deps: {
          runId: () => runId,
          registry: createServerRegistry(convId),
          planner: async (q, signal) => {
            const plan = await createExecutionPlan(q, signal, {
              completeJson: async (prompt, signal2) => {
                const r = await serverJsonComplete({
                  systemPrompt: ORCHESTRATOR_PLANNER_PROMPT,
                  userPrompt: prompt,
                  signal: signal2,
                });
                console.log(`[orch] planner 原始返回: ${JSON.stringify(r.value).slice(0, 200)}`);
                return r.value;
              },
            }, { conversation });
            console.log(`[orch] plan=${plan.intent} tasks=${plan.tasks.length} convLen=${conversation.length}`);
            return plan;
          },
          aggregate: (options) =>
            aggregateResults({
              ...options,
              complete: async (prompt, signal, onDelta) => {
                const r = await serverStreamChat({
                  messages: [{ role: "user", content: prompt }],
                  systemPrompt: ORCHESTRATOR_AGGREGATION_PROMPT,
                  temperature: 0.2,
                  maxTokens: 3000,
                  signal,
                  onContent: onDelta,
                });
                return r.content;
              },
            }),
        },
      });
      // 自定义终局事件：最终正文（direct 计划/聚合结果/单专家直通统一出口）。
      // 必须走 enqueueEvent 串行链——与 run.completed 的落库顺序才不竞态。
      await this.enqueueEvent(runId, convId, {
        type: "run.final", runId, at: Date.now(), output,
      } as OrchestrationEvent & { output: string });
    } catch (error) {
      // runOrchestration 已保证 run.cancelled / run.failed 事件发出；这里兜底异常记录
      if (!controller.signal.aborted && !failureRecorded) {
        await this.recordEvent(runId, convId, {
          type: "run.failed", runId, at: Date.now(),
          error: { code: "engine_error", message: String((error as Error)?.message || error) },
        }).catch(() => undefined);
      }
    } finally {
      this.controllers.delete(runId);
      // 事件串行链收尾清理（给晚到的重试事件留 60s 缓冲）
      setTimeout(() => this.eventQueues.delete(runId), 60_000).unref?.();
    }
  }

  /** 单点：事件落库 → 投影更新 → SSE 广播（带 seq 回放游标）。 */
  private async recordEvent(
    runId: string,
    convId: string,
    event: OrchestrationEvent,
  ): Promise<void> {
    const taskId = "task" in event && event.task?.id ? event.task.id
      : "taskId" in event && typeof event.taskId === "string" ? event.taskId
      : null;
    const inserted = await this.db.query<{ seq: number }>(
      `INSERT INTO agent_events (run_id, conv_id, task_id, type, payload)
       VALUES ($1, $2, $3, $4, $5) RETURNING seq`,
      [runId, convId, taskId, event.type, JSON.stringify(event)],
    );
    const seq = inserted.rows[0]!.seq;
    await this.project(convId, runId, event);
    const withSeq = Object.assign({}, event, { seq }) as OrchestrationEvent & { seq: number };
    const subs = this.sseBus.get(runId);
    if (subs) for (const s of [...subs]) { try { s(withSeq); } catch { /* 订阅者自清理 */ } }
  }

  /** 投影映射（事件类型 → 表更新）。禁止旁路直写投影。 */
  private async project(convId: string, runId: string, ev: OrchestrationEvent): Promise<void> {
    const db = this.db;
    switch (ev.type) {
      case "plan.completed":
        await db.query(`UPDATE agent_runs SET status='running', plan=$2 WHERE id=$1`, [runId, JSON.stringify(ev.plan)]);
        break;
      case "task.pending":
        await db.query(
          `INSERT INTO agent_tasks (id, run_id, agent_id, title, status, attempt)
           VALUES ($1,$2,$3,$4,'pending',1) ON CONFLICT (id) DO NOTHING`,
          [ev.task.id, runId, ev.task.agentId, ev.task.title],
        );
        break;
      case "task.started":
        await db.query(`UPDATE agent_tasks SET status='running', started_at=now() WHERE id=$1`, [ev.taskId]);
        break;
      case "task.completed":
        await db.query(
          `UPDATE agent_tasks SET status='done', output=$2, summary=$3, sources=$4,
             degraded=$5, usage=$6, completed_at=now() WHERE id=$1`,
          [ev.taskId, ev.result.output, ev.result.summary,
            JSON.stringify(ev.result.sources), ev.result.degraded ?? null,
            JSON.stringify({ startedAtHint: null })],
        );
        break;
      case "task.timeout":
        await db.query(`UPDATE agent_tasks SET status='timeout', completed_at=now() WHERE id=$1`, [ev.taskId]);
        break;
      case "task.failed":
        await db.query(`UPDATE agent_tasks SET status='error', completed_at=now() WHERE id=$1`, [ev.taskId]);
        break;
      case "task.cancelled":
        await db.query(`UPDATE agent_tasks SET status='cancelled', completed_at=now() WHERE id=$1`, [ev.taskId]);
        break;
      case "aggregation.started":
        await db.query(`UPDATE agent_runs SET status='aggregating' WHERE id=$1`, [runId]);
        break;
      case "run.completed":
        await db.query(`UPDATE agent_runs SET status='completed', completed_at=now() WHERE id=$1`, [runId]);
        break;
      case "run.cancelled":
        await db.query(`UPDATE agent_runs SET status='cancelled', completed_at=now() WHERE id=$1`, [runId]);
        break;
      case "run.failed":
        await db.query(`UPDATE agent_runs SET status='error', error=$2, completed_at=now() WHERE id=$1`, [runId, ev.error?.message ?? null]);
        break;
      case "run.final": {
        const output = (ev as unknown as { output: string }).output ?? "";
        await db.query(
          `INSERT INTO messages (conv_id, seq, role, content, meta)
           VALUES ($1, (SELECT COALESCE(MAX(seq),0)+1 FROM messages WHERE conv_id=$1), 'assistant', $2, $3)`,
          [convId, output, JSON.stringify({ run_id: runId })],
        );
        break;
      }
      default:
        break; // delta/progress 等仅入事件日志
    }
  }

  /** SSE：先回放 DB 中 seq > from 的事件，再订阅实时。 */
  subscribe(
    runId: string,
    from: number,
    write: (event: OrchestrationEvent & { seq: number }) => void,
    onOpen: () => Promise<void>,
    onClose: () => void,
  ): () => void {
    let closed = false;
    const sub: Subscriber = (event) => { if (!closed) write(event); };
    const open = (async () => {
      const replay = await this.db.query<{ seq: number | string; payload: string }>(
        `SELECT seq, payload FROM agent_events WHERE run_id=$1 AND seq > $2 ORDER BY seq`,
        [runId, from],
      );
      for (const row of replay.rows) {
        try {
          // pg 对 jsonb 列自动反序列化为对象（历史版本曾是字符串，双兼容）
          const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
          write(Object.assign(payload, { seq: Number(row.seq) }));
        } catch { /* 坏行跳过 */ }
      }
      if (!closed) {
        let set = this.sseBus.get(runId);
        if (!set) { set = new Set(); this.sseBus.set(runId, set); }
        set.add(sub);
        await onOpen();
      }
    })();
    open.catch((e) => {
      console.error("[orch] SSE 订阅失败:", (e as Error)?.message);
      if (!closed) { closed = true; onClose(); }
    });
    return () => {
      closed = true;
      this.sseBus.get(runId)?.delete(sub);
      if (this.sseBus.get(runId)?.size === 0) this.sseBus.delete(runId);
      onClose();
    };
  }

  async cancel(runId: string): Promise<boolean> {
    const controller = this.controllers.get(runId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async retry(runId: string, taskId: string): Promise<void> {
    // shared orchestrator 的 runtimeExecutions 持有运行时；事件经原 onEvent 闭环回流
    await retryOrchestrationTask(runId, taskId);
  }
}
