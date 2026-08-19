import { useEffect, useId, useState } from 'react'

import type { AgentSource, AgentTaskState } from '../../orchestration/types'

export const AGENT_NAMES: Record<AgentTaskState['agentId'], string> = {
  consulting: '出海智询',
  taxiq: 'TaxIQ',
  odi: 'ODI智能体',
}

const STATUS_META: Record<AgentTaskState['status'], { label: string; mark: string; color: string }> = {
  pending: { label: '等待调用', mark: '○', color: '#94a3b8' },
  running: { label: '调用中', mark: '◌', color: '#1a5bc6' },
  done: { label: '已完成', mark: '✓', color: '#16845b' },
  timeout: { label: '已超时', mark: '◷', color: '#b7791f' },
  error: { label: '调用失败', mark: '!', color: '#c2413b' },
  cancelled: { label: '已取消', mark: '—', color: '#7c8da8' },
}

interface Props {
  task: AgentTaskState
  onRetry?: (taskId: string) => void
}

export function AgentTaskItem({ task, onRetry }: Props) {
  const agentName = AGENT_NAMES[task.agentId]
  const status = STATUS_META[task.status]
  const latestProgress = task.progress[task.progress.length - 1]
  const elapsed = useTaskElapsed(task)
  const [outputExpanded, setOutputExpanded] = useState(false)
  const outputId = useId()

  return (
    <article style={{ position: 'relative', padding: '9px 0 9px 20px', borderLeft: '1px solid #dbe7f5' }}>
      <span
        aria-hidden="true"
        className={task.status === 'running' ? 'agent-run-pulse' : undefined}
        style={{ position: 'absolute', left: -7, top: 11, width: 13, height: 13, borderRadius: '50%', background: '#fff', color: status.color, fontSize: 11, lineHeight: '12px', textAlign: 'center', fontWeight: 750 }}
      >
        {status.mark}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
        <span style={{ color: '#264566', fontSize: 12, fontWeight: 650 }}>调用 {agentName}</span>
        <span style={{ color: status.color, fontSize: 11, fontWeight: 600 }}>{status.label}</span>
        {elapsed && <span style={{ color: '#94a3b8', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>}
        {(task.status === 'timeout' || task.status === 'error') && onRetry && (
          <button
            type="button"
            aria-label={`重试 ${agentName}`}
            onClick={(event) => {
              event.stopPropagation()
              onRetry(task.id)
            }}
            style={{ marginLeft: 'auto', border: '1px solid #bfdbfe', borderRadius: 5, background: '#fff', color: '#1a5bc6', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}
          >
            重试
          </button>
        )}
      </div>
      <div style={{ marginTop: 3, color: '#3a4f72', fontSize: 12 }}>{task.title}</div>
      {latestProgress && task.status === 'running' && (
        <div aria-live="polite" style={{ marginTop: 4, color: '#71839e', fontSize: 11.5, lineHeight: 1.55 }}>
          {latestProgress}
        </div>
      )}
      {task.status === 'done' && task.summary && (
        <div style={{ marginTop: 5, color: '#526987', fontSize: 11.5, lineHeight: 1.6 }}>{task.summary}</div>
      )}
      {(task.status === 'error' || task.status === 'timeout') && (
        <div role="status" style={{ marginTop: 5, color: task.status === 'error' ? '#a83d38' : '#9a6a18', fontSize: 11.5 }}>
          {task.error?.message ?? (task.status === 'timeout' ? '专业智能体响应超时，可单独重试' : '专业智能体暂时无法完成此任务')}
        </div>
      )}
      {task.status === 'cancelled' && (
        <div style={{ marginTop: 5, color: '#7c8da8', fontSize: 11.5 }}>任务已停止，已保留现有进度</div>
      )}
      {task.status === 'done' && task.sources.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px' }}>
          <span style={{ color: '#94a3b8', fontSize: 10.5 }}>{task.sources.length} 个来源</span>
          {task.sources.map((source, index) => (
            <SourceReference key={`${source.title}-${index}`} source={source} />
          ))}
        </div>
      )}
      {task.status === 'done' && task.output.trim() && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            aria-expanded={outputExpanded}
            aria-controls={outputId}
            aria-label={`${outputExpanded ? '收起' : '查看'} ${agentName} 完整结果`}
            onClick={(event) => {
              event.stopPropagation()
              setOutputExpanded((current) => !current)
            }}
            style={{ border: 0, background: 'transparent', color: '#5275a2', cursor: 'pointer', fontSize: 11, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {outputExpanded ? '收起完整结果' : '查看完整结果'}
            <span aria-hidden="true">{outputExpanded ? '▴' : '▾'}</span>
          </button>
          {outputExpanded && (
            <div id={outputId} style={{ marginTop: 6, padding: '8px 10px', borderRadius: 7, background: '#f7f9fc', border: '1px solid #e7edf5', color: '#405675', fontSize: 11.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
              {task.output}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function useTaskElapsed(task: AgentTaskState): string | null {
  const [now, setNow] = useState(() => Date.now())
  const live = task.status === 'running' && task.startedAt !== undefined

  useEffect(() => {
    if (!live) return
    setNow(Date.now())
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(intervalId)
  }, [live, task.startedAt])

  if (task.startedAt === undefined) return null
  const endedAt = task.completedAt ?? task.timedOutAt ?? now
  const seconds = Math.max(0, Math.floor((endedAt - task.startedAt) / 1_000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes} 分钟` : `${minutes} 分 ${remainder} 秒`
}

function SourceReference({ source }: { source: AgentSource }) {
  if (isSafeExternalUrl(source.url)) {
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#5275a2', fontSize: 10.5, textDecoration: 'none' }}>
        {source.title}
      </a>
    )
  }

  return <span style={{ color: '#71839e', fontSize: 10.5 }}>{source.title}</span>
}

function isSafeExternalUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
