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

export function defaultRange(): { from: string; to: string } {
  const from = startOfWeek(today())
  return { from, to: endOfWeek(addDays(from, 7 * 7)) }
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
