// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AgentRunState, AgentTaskState, TaskStatus } from '../../../orchestration/types'
import { AgentRunTrace } from '../AgentRunTrace'

const STARTED_AT = 10_000

function task(
  id: string,
  agentId: AgentTaskState['agentId'],
  status: TaskStatus,
  overrides: Partial<AgentTaskState> = {},
): AgentTaskState {
  return {
    id,
    agentId,
    title: `${agentId} 子任务`,
    instruction: '完成专业分析',
    expectedOutput: '专业结论',
    status,
    output: '',
    progress: [],
    sources: [],
    ...overrides,
  }
}

function run(
  status: AgentRunState['status'],
  tasks: AgentTaskState[],
  overrides: Partial<AgentRunState> = {},
): AgentRunState {
  return {
    runId: 'run-1',
    messageId: 'message-1',
    status,
    tasks: Object.fromEntries(tasks.map((item) => [item.id, item])),
    taskOrder: tasks.map((item) => item.id),
    plan: {
      intent: tasks.length > 1 ? 'compound' : 'single',
      directAnswerAllowed: false,
      tasks: tasks.map(({ agentId, title, instruction, expectedOutput }) => ({
        agentId,
        title,
        instruction,
        expectedOutput,
      })),
      aggregationRequired: tasks.length > 1,
      rationaleSummary: '按专业领域并行处理',
    },
    aggregation: {
      status: status === 'aggregating' ? 'streaming' : status === 'completed' ? 'done' : 'waiting',
      output: '',
      usedTaskIds: [],
    },
    startedAt: STARTED_AT,
    completedAt: status === 'completed' ? STARTED_AT + 4_000 : undefined,
    ...overrides,
  }
}

const runningFixture = run('running', [
  task('tax-task', 'taxiq', 'running', {
    startedAt: STARTED_AT,
    progress: ['正在识别税收协定', '正在核验税率'],
  }),
  task('odi-task', 'odi', 'pending'),
])

const completedFixture = run('completed', [
  task('tax-task', 'taxiq', 'done', {
    startedAt: STARTED_AT,
    completedAt: STARTED_AT + 2_000,
    summary: '已完成税务要点核验',
    output: 'TaxIQ 完整专业输出',
    sources: [
      { title: '税务机关', url: 'https://example.com/tax' },
      { title: '内部依据' },
    ],
  }),
  task('odi-task', 'odi', 'done', {
    startedAt: STARTED_AT,
    completedAt: STARTED_AT + 3_000,
    summary: '已完成 ODI 路径核验',
    output: 'ODI 完整专业输出',
  }),
])

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('AgentRunTrace', () => {
  it('keeps a running compound trace expanded with its plan and live task calls', () => {
    render(<AgentRunTrace run={runningFixture} />)

    expect(screen.getByRole('button', { name: /收起专业智能体调用轨迹/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('执行计划')).toBeTruthy()
    expect(screen.getByText('并行调用 2 个专业智能体')).toBeTruthy()
    expect(screen.getByText('调用 TaxIQ')).toBeTruthy()
    expect(screen.getByText('调用 ODI智能体')).toBeTruthy()
  })

  it('collapses 1200ms after completion and can be manually reopened', () => {
    vi.useFakeTimers()
    const { rerender } = render(<AgentRunTrace run={runningFixture} />)

    rerender(<AgentRunTrace run={completedFixture} />)
    act(() => vi.advanceTimersByTime(1_199))
    expect(screen.getByText('调用 TaxIQ')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1))
    const summary = screen.getByRole('button', { name: /展开专业智能体调用轨迹/ })
    expect(summary.getAttribute('aria-expanded')).toBe('false')
    expect(summary.textContent).toContain('已调用 2 个专业智能体 · 2 已完成')
    expect(screen.queryByText('调用 TaxIQ')).toBeNull()

    fireEvent.click(summary)
    expect(screen.getByRole('button', { name: /收起专业智能体调用轨迹/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('调用 TaxIQ')).toBeTruthy()
  })

  it('does not auto-collapse again after the user manually opens a completed run', () => {
    vi.useFakeTimers()
    render(<AgentRunTrace run={completedFixture} />)
    act(() => vi.advanceTimersByTime(1_200))
    fireEvent.click(screen.getByRole('button', { name: /展开专业智能体调用轨迹/ }))

    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByText('调用 TaxIQ')).toBeTruthy()
  })

  it('starts a fresh 1200ms collapse delay when switching between completed runs', () => {
    vi.useFakeTimers()
    const runA = { ...completedFixture, runId: 'run-a' }
    const runB = { ...completedFixture, runId: 'run-b' }
    const { rerender } = render(<AgentRunTrace run={runA} />)

    act(() => vi.advanceTimersByTime(1_000))
    rerender(<AgentRunTrace run={runB} />)
    act(() => vi.advanceTimersByTime(1_199))
    expect(screen.getByText('调用 TaxIQ')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('调用 TaxIQ')).toBeNull()
  })

  it('does not leak a manually opened completed state into the next run', () => {
    vi.useFakeTimers()
    const runA = { ...completedFixture, runId: 'run-a' }
    const runB = { ...completedFixture, runId: 'run-b' }
    const { rerender } = render(<AgentRunTrace run={runA} />)
    act(() => vi.advanceTimersByTime(1_200))
    fireEvent.click(screen.getByRole('button', { name: /展开专业智能体调用轨迹/ }))

    rerender(<AgentRunTrace run={runB} />)
    act(() => vi.advanceTimersByTime(1_200))
    expect(screen.queryByText('调用 TaxIQ')).toBeNull()
  })

  it('automatically reopens when a completed run is retried', () => {
    vi.useFakeTimers()
    const { rerender } = render(<AgentRunTrace run={completedFixture} />)
    act(() => vi.advanceTimersByTime(1_200))
    expect(screen.queryByText('调用 TaxIQ')).toBeNull()

    const retried = run('running', [
      ...completedFixture.taskOrder.map((id) => completedFixture.tasks[id]!),
      task('tax-retry', 'taxiq', 'running', { startedAt: STARTED_AT + 5_000 }),
    ])
    rerender(<AgentRunTrace run={retried} />)

    expect(screen.getAllByText('调用 TaxIQ')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /收起专业智能体调用轨迹/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('uses compact presentation for one professional task', () => {
    render(<AgentRunTrace run={run('running', [task('consulting-task', 'consulting', 'running')])} />)

    expect(screen.getByText('调用 出海智询')).toBeTruthy()
    expect(screen.queryByText('执行计划')).toBeNull()
    expect(screen.queryByText(/并行调用/)).toBeNull()
  })

  it.each<[TaskStatus, string]>([
    ['pending', '等待调用'],
    ['running', '调用中'],
    ['done', '已完成'],
    ['timeout', '已超时'],
    ['error', '调用失败'],
    ['cancelled', '已取消'],
  ])('renders a clear %s status label', (status, label) => {
    render(<AgentRunTrace run={run('running', [task('task-1', 'taxiq', status)])} />)
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('shows only the latest progress update', () => {
    render(<AgentRunTrace run={runningFixture} />)
    expect(screen.getByText('正在核验税率')).toBeTruthy()
    expect(screen.queryByText('正在识别税收协定')).toBeNull()
  })

  it('updates the elapsed time while a task is running', () => {
    vi.useFakeTimers()
    vi.setSystemTime(STARTED_AT + 2_000)
    render(<AgentRunTrace run={run('running', [task('task-1', 'taxiq', 'running', { startedAt: STARTED_AT })])} />)
    expect(screen.getByText('2 秒')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('3 秒')).toBeTruthy()
  })

  it('exposes completed output and safe source links through accessible disclosure controls', () => {
    render(<AgentRunTrace run={completedFixture} />)

    expect(screen.getByText('已完成税务要点核验')).toBeTruthy()
    const outputButton = screen.getByRole('button', { name: '查看 TaxIQ 完整结果' })
    expect(outputButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(outputButton)
    expect(outputButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('TaxIQ 完整专业输出')).toBeTruthy()
    expect(screen.getByRole('link', { name: '税务机关' }).getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('link', { name: '税务机关' }).getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByText('2 个来源')).toBeTruthy()
  })

  it('does not create navigable links for unsafe source URLs', () => {
    const unsafeRun = run('running', [
      task('task-1', 'taxiq', 'done', {
        summary: '核验完成',
        output: '结果',
        sources: [{ title: '不安全来源', url: 'javascript:alert(1)' }],
      }),
    ])
    render(<AgentRunTrace run={unsafeRun} />)

    expect(screen.getByText('不安全来源')).toBeTruthy()
    expect(screen.queryByRole('link', { name: '不安全来源' })).toBeNull()
  })

  it.each(['timeout', 'error'] as const)('retries a %s task without toggling the parent trace', (status) => {
    const onRetry = vi.fn()
    render(<AgentRunTrace run={run('running', [task('failed-task', 'odi', status)])} onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: '重试 ODI智能体' }))
    expect(onRetry).toHaveBeenCalledWith('failed-task')
    expect(screen.getByText('调用 ODI智能体')).toBeTruthy()
    expect(screen.getByRole('button', { name: /收起专业智能体调用轨迹/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('announces aggregation in the summary', () => {
    render(<AgentRunTrace run={run('aggregating', completedFixture.taskOrder.map((id) => completedFixture.tasks[id]!))} />)
    expect(screen.getByText('正在整合专业智能体结果')).toBeTruthy()
  })

  it('counts cancelled tasks as unfinished in a completed summary', () => {
    render(<AgentRunTrace run={run('completed', [
      task('done-task', 'taxiq', 'done'),
      task('cancelled-task', 'odi', 'cancelled'),
    ])} />)
    expect(screen.getByRole('button', { name: /专业智能体调用轨迹/ }).textContent).toContain('1 未完成')
  })

  it.each([
    ['planning', '◌'],
    ['running', '◌'],
    ['aggregating', '◌'],
    ['completed', '✓'],
    ['error', '!'],
    ['cancelled', '—'],
  ] as const)('uses the correct top-level icon for a %s run', (status, mark) => {
    const { container } = render(<AgentRunTrace run={run(status, [task('task-1', 'taxiq', status === 'completed' ? 'done' : status === 'cancelled' ? 'cancelled' : status === 'error' ? 'error' : 'running')])} />)
    const icon = container.querySelector(`[data-run-status-icon="${status}"]`)
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.textContent).toBe(mark)
  })
})
