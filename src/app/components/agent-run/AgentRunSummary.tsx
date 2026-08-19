import type { AgentRunState } from '../../orchestration/types'

interface Props {
  run: AgentRunState
}

export function AgentRunSummary({ run }: Props) {
  const tasks = run.taskOrder
    .map((taskId) => run.tasks[taskId])
    .filter((task) => task !== undefined)
  const completed = tasks.filter((task) => task.status === 'done').length
  const unavailable = tasks.filter((task) => task.status === 'error' || task.status === 'timeout' || task.status === 'cancelled').length

  if (run.status === 'aggregating') {
    return <span>正在整合专业智能体结果</span>
  }

  if (run.status === 'completed') {
    return (
      <span>
        已调用 {tasks.length} 个专业智能体 · {completed} 已完成
        {unavailable > 0 ? ` · ${unavailable} 未完成` : ''}
      </span>
    )
  }

  if (run.status === 'planning') {
    return <span>正在规划专业智能体调用</span>
  }

  if (run.status === 'cancelled') {
    return <span>专业智能体调用已取消</span>
  }

  if (run.status === 'error') {
    return <span>专业智能体调用未完成</span>
  }

  return <span>{tasks.length} 个专业智能体正在协同</span>
}
