-- ═══════════════════════════════════════════════════════════════════
-- M1 · 001_init — 事件日志 + 运行/任务投影 + 逐调用记账
-- 设计：docs/design/m1-backend-draft.md §3
-- 口径：Postgres 16（Docker）；SQLite(WAL) 备选时 JSONB→TEXT、BIGSERIAL→INTEGER
-- 纪律：编号只增、前向 only、幂等可重放（IF NOT EXISTS）
-- ═══════════════════════════════════════════════════════════════════

-- 迁移版本表（迁移执行器读写；手工执行时也先建它）
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INT PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ① 事实源：append-only 事件日志（run 生命周期 + 模型可见消息）
--    不变式：模型可见 ⟺ 已落库（model_visible）
--    SSE 回放游标 = seq
CREATE TABLE IF NOT EXISTS agent_events (
  seq            BIGSERIAL PRIMARY KEY,
  run_id         TEXT NOT NULL,
  conv_id        TEXT NOT NULL,
  task_id        TEXT,
  type           TEXT NOT NULL,               -- 复用现有 19 种 OrchestrationEvent + message.usage
  payload        JSONB NOT NULL,
  model_visible  BOOLEAN NOT NULL DEFAULT false,
  schema_version INT NOT NULL DEFAULT 1,      -- 事件结构版本（dsh SESSION_FORMAT_VERSION 口径）
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_events_run  ON agent_events (run_id, seq);
CREATE INDEX IF NOT EXISTS idx_agent_events_conv ON agent_events (conv_id, seq);

-- ②③ 投影：会话与消息（列表查询走投影，不扫日志）
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  user_key      TEXT NOT NULL,                -- M1 匿名（客户端稳定生成）；M2 接真实账号
  title         TEXT,
  profile_block TEXT,                         -- R1: 会话创建时冻结的用户档案（稳定前缀的组成）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS messages (
  id         BIGSERIAL PRIMARY KEY,
  conv_id    TEXT NOT NULL,
  seq        INT NOT NULL,                    -- 会话内消息序号（用户可见顺序）
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,                   -- 原文存储（R3：字节稳定，不重格式化）
  meta       JSONB,                           -- quickQuestions / run 摘要等
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conv_id, seq)
);

-- ④⑤ 投影：运行与任务（重试/审计/看板查询）
CREATE TABLE IF NOT EXISTS agent_runs (
  id           TEXT PRIMARY KEY,              -- run-<uuid>
  conv_id      TEXT NOT NULL,
  question     TEXT NOT NULL,
  plan         JSONB,                         -- ExecutionPlan 快照（planner 输出）
  status       TEXT NOT NULL,                 -- planning|running|aggregating|completed|cancelled|error
  usage        JSONB,                         -- {input,output,cache_hit,cost_usd}
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_conv ON agent_runs (conv_id, started_at);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id          TEXT PRIMARY KEY,               -- taskId（scheduler 生成）
  run_id      TEXT NOT NULL,
  agent_id    TEXT NOT NULL,                  -- consulting | taxiq | odi
  title       TEXT,
  status      TEXT NOT NULL,                  -- pending|running|done|timeout|error|cancelled
  attempt     INT NOT NULL DEFAULT 1,         -- 重试递增
  output      TEXT,
  summary     TEXT,
  sources     JSONB,                          -- [{title,url}]
  degraded    TEXT,                           -- TaxIQ 兜底等降级说明
  usage       JSONB,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_run ON agent_tasks (run_id);

-- ⑥ 逐调用记账（DeepSeek 口径治理 + R5 缓存命中率度量）
CREATE TABLE IF NOT EXISTS model_calls (
  id                BIGSERIAL PRIMARY KEY,
  run_id            TEXT,
  task_id           TEXT,
  purpose           TEXT NOT NULL,            -- planner|expert_answer|aggregation|taxiq_fallback|title|memory_extract
  model             TEXT NOT NULL,
  thinking          BOOLEAN,
  effort            TEXT,
  prompt_tokens     INT,
  completion_tokens INT,
  cache_hit_tokens  INT,                      -- DeepSeek prompt_cache_hit_tokens
  reasoning_tokens  INT,
  latency_ms        INT,
  cost_usd          NUMERIC(10,6),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_calls_run ON model_calls (run_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_created ON model_calls (created_at);

-- ⑦ 超限工具结果落盘（字节预算第一阶；M1 预留不启用）
CREATE TABLE IF NOT EXISTS overflow_results (
  id      BIGSERIAL PRIMARY KEY,
  task_id TEXT NOT NULL,
  kind    TEXT,                               -- taxiq_answer | aggregation_output | ...
  content TEXT NOT NULL,
  preview TEXT NOT NULL,
  bytes   INT NOT NULL
);

-- 记录本迁移
INSERT INTO schema_migrations (version, name)
VALUES (1, '001_init')
ON CONFLICT (version) DO NOTHING;
