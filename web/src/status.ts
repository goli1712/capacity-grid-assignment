export type Status = 'over' | 'full' | 'under'

// Strictly greater: any allocation against zero capacity is over.
export function statusOf(allocated: number, capacity: number): Status {
  if (allocated > capacity) return 'over'
  if (allocated === capacity) return 'full'
  return 'under'
}

export const STATUS_TEXT: Record<Status, string> = {
  over: 'Over-allocated',
  full: 'Fully allocated',
  under: 'Has room',
}
