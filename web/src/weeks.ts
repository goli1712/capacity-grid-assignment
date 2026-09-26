// Calendar dates as 'YYYY-MM-DD' strings. Arithmetic runs in UTC so a DST
// change can never shift a date by a day.

const DAY_MS = 24 * 60 * 60 * 1000

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  return format(new Date(parse(date).getTime() + days * DAY_MS))
}

function daysSinceMonday(date: string): number {
  return (parse(date).getUTCDay() + 6) % 7
}

export function startOfWeek(date: string): string {
  return addDays(date, -daysSinceMonday(date))
}

export function endOfWeek(date: string): string {
  return addDays(date, 6 - daysSinceMonday(date))
}

// Today in the viewer's own time zone.
function today(): string {
  const now = new Date()
  return format(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function currentWeek(): string {
  return startOfWeek(today())
}

export function defaultRange(): Range {
  const from = currentWeek()
  return { from, to: endOfWeek(addDays(from, 7 * 7)) }
}

export function mondaysIn({ from, to }: Range): string[] {
  const mondays: string[] = []
  for (let monday = from; monday <= to; monday = addDays(monday, 7)) {
    mondays.push(monday)
  }
  return mondays
}

const weekLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export function formatWeek(monday: string): { label: string; year: number } {
  const date = parse(monday)
  return { label: weekLabel.format(date), year: date.getUTCFullYear() }
}

const workWeekLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

// "Mon 5 Jan – Fri 9 Jan 2026": the working days of the week starting on `monday`.
export function formatWorkWeek(monday: string): string {
  return workWeekLabel.formatRange(parse(monday), parse(addDays(monday, 4)))
}

const rangeLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatRange({ from, to }: Range): string {
  return rangeLabel.formatRange(parse(from), parse(to))
}

const MAX_WEEKS = 26

export type Range = { from: string; to: string }

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && format(parse(value)) === value
}

export function expandRange({ from, to }: Range): Range {
  return { from: startOfWeek(from), to: endOfWeek(to) }
}

export function shiftRange(range: Range, weeks: number): Range {
  return { from: addDays(range.from, 7 * weeks), to: addDays(range.to, 7 * weeks) }
}

export function sameRange(a: Range, b: Range): boolean {
  return a.from === b.from && a.to === b.to
}

// Mirrors the server's 400s, so an invalid range is never requested.
export function rangeError({ from, to }: Range): string | null {
  if (!isDate(from) || !isDate(to)) return 'Enter a valid From and To date.'
  if (to < from) return 'To is before From.'
  const weeks = (parse(endOfWeek(to)).getTime() - parse(startOfWeek(from)).getTime() + DAY_MS) / (7 * DAY_MS)
  if (weeks > MAX_WEEKS) return `That range covers ${weeks} weeks; the maximum is ${MAX_WEEKS}.`
  return null
}
