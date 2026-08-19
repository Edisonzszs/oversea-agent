import { useEffect, useRef, useState } from 'react'

import type { AgentRunState } from '../../orchestration/types'
import { AgentRunSummary } from './AgentRunSummary'
import { AgentTaskItem } from './AgentTaskItem'

const AUTO_COLLAPSE_DELAY_MS = 1_200
const RUN_STATUS_ICON: Record<AgentRunState['status'], { mark: string; color: string }> = {
  planning: { mark: '◌', color: '#1a5bc6' },
  running: { mark: '◌', color: '#1a5bc6' },
  aggregating: { mark: '◌', color: '#1a5bc6' },
  completed: { mark: '✓', color: '#16845b' },
  error: { mark: '!', color: '#c2413b' },
  cancelled: { mark: '—', color: '#7c8da8' },
}

interface Props {
  run: AgentRunState
  onRetry?: (taskId: string) => void
}

function isActiveRun(run: AgentRunState): boolean {
  return run.status === 'planning' || run.status === 'running' || run.status === 'aggregating'
}

export function AgentRunTrace({ run, onRetry }: Props) {
  const [expanded, setExpanded] = useState(true)
  const manuallyOpened = useRef(false)
  const active = isActiveRun(run)
  const tasks = run.taskOrder
    .map((taskId) => run.tasks[taskId])
    .filter((task) => task !== undefined)
  const compound = tasks.length > 1
  const runIcon = RUN_STATUS_ICON[run.status]

  useEffect(() => {
    manuallyOpened.current = false
    setExpanded(true)
  }, [run.runId])

  useEffect(() => {
    if (active) {
      setExpanded(true)
      return
    }

    if (run.status !== 'completed' || manuallyOpened.current) return
    const timeoutId = window.setTimeout(() => setExpanded(false), AUTO_COLLAPSE_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [active, run.runId, run.status])

  const toggleExpanded = () => {
    if (active) return
    setExpanded((current) => {
      if (!current) manuallyOpened.current = true
      return !current
    })
  }

  return (
    <section
      aria-label="专业智能体调用轨迹"
      style={{ marginBottom: 12, borderBottom: '1px solid #edf2f8', paddingBottom: expanded ? 10 : 7 }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-disabled={active}
        aria-label={`${expanded ? '收起' : '展开'}专业智能体调用轨迹`}
        onClick={toggleExpanded}
        style={{ width: '100%', border: 0, background: 'transparent', padding: '1px 0', cursor: active ? 'default' : 'pointer', color: '#526987', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11.5, textAlign: 'left' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span
            aria-hidden="true"
            data-run-status-icon={run.status}
            style={{ color: runIcon.color }}
          >
            {runIcon.mark}
          </span>
          <AgentRunSummary run={run} />
        </span>
        <span aria-hidden="true" style={{ color: '#8ca0bc', fontSize: 10 }}>{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: compound ? 8 : 4 }}>
          {compound && (
            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: '#304766', fontSize: 11.5, fontWeight: 650 }}>执行计划</span>
              <span style={{ color: '#7c8da8', fontSize: 11 }}>并行调用 {tasks.length} 个专业智能体</span>
            </div>
          )}
          <div>
            {tasks.map((task) => (
              <AgentTaskItem key={task.id} task={task} onRetry={onRetry} />
            ))}
          </div>
        </div>
      )}
      <style>{`
        @keyframes agentRunPulse {
          0%, 100% { opacity: 0.55; transform: scale(0.88); }
          50% { opacity: 1; transform: scale(1); }
        }
        .agent-run-pulse { animation: agentRunPulse 1.2s ease-in-out infinite; }
      `}</style>
    </section>
  )
}
