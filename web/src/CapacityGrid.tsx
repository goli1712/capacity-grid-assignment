import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchCapacity, type PersonCapacity } from './api'
import { endOfWeek, formatWeek, startOfWeek } from './weeks'

type Props = {
  from: string
  to: string
}

type Status = 'over' | 'full' | 'under'

// Strictly greater: any allocation against zero capacity is over.
function statusOf(allocated: number, capacity: number): Status {
  if (allocated > capacity) return 'over'
  if (allocated === capacity) return 'full'
  return 'under'
}

const STATUS_TEXT: Record<Status, string> = {
  over: 'Over-allocated',
  full: 'Fully allocated',
  under: 'Has room',
}

const hoursFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

// CapacityGrid renders one row per person and one column per week, showing
// how allocated each person is and making over-allocation obvious.
//
// It reads from GET /api/capacity?from=&to= — the response shape is whatever
// you decided on in the API.
//
// A person's weekly hours are editable from the grid. After a save, every
// number that depends on them must be right — without a full page reload.
//
// TODO: implement.
export function CapacityGrid({ from, to }: Props) {
  // Key the cache by the whole-week range the server will actually use, so
  // mid-week dates that expand to the same weeks share one entry.
  const weekFrom = startOfWeek(from)
  const weekTo = endOfWeek(to)
  const { data, error, isPending, isPlaceholderData } = useQuery({
    queryKey: ['capacity', weekFrom, weekTo],
    queryFn: ({ signal }) => fetchCapacity(weekFrom, weekTo, signal),
    placeholderData: keepPreviousData,
  })

  const people = useMemo(
    () => (data ? [...data.people].sort((a, b) => byName.compare(a.name, b.name)) : []),
    [data],
  )

  if (isPending) return <p>Loading capacity…</p>
  if (error) return <p role="alert">Could not load capacity: {error.message}</p>

  return (
    <>
      <div className="grid-bar">
        <Legend />
        <p className="updating" role="status">
          {isPlaceholderData && 'Updating…'}
        </p>
      </div>
      <div className="grid-scroll" aria-busy={isPlaceholderData}>
        <table className="grid">
          <caption className="visually-hidden">
            Allocated hours against weekly capacity, {data.from} to {data.to}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="name">
                Person
              </th>
              <th scope="col" className="num">
                Capacity
              </th>
              <th scope="col" className="num">
                Weeks over
              </th>
              {data.weeks.map((monday) => {
                const { label, year } = formatWeek(monday)
                return (
                  <th scope="col" key={monday} className="week">
                    <time dateTime={monday}>
                      <span className="visually-hidden">Week of </span>
                      {label}
                      <span className="year">{year}</span>
                    </time>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PersonRow({ person }: { person: PersonCapacity }) {
  const statuses = person.allocated.map((a) => statusOf(a, person.capacity))
  const weeksOver = statuses.filter((s) => s === 'over').length

  return (
    <tr>
      <th scope="row" className="name">
        <span dir="auto">{person.name}</span>
      </th>
      <td className="num">{hoursFormat.format(person.capacity)} h</td>
      <td className="num">
        {weeksOver > 0 ? (
          <span className="over-count">
            <span aria-hidden="true">▲ </span>
            {weeksOver}
          </span>
        ) : (
          <span className="muted">0</span>
        )}
      </td>
      {person.allocated.map((allocated, i) => (
        <td key={i} className={`cell cell--${statuses[i]}`}>
          {statuses[i] === 'over' && (
            <span className="marker" aria-hidden="true">
              ▲{' '}
            </span>
          )}
          {hoursFormat.format(allocated)} / {hoursFormat.format(person.capacity)}
          <span className="visually-hidden">, {STATUS_TEXT[statuses[i]]}</span>
        </td>
      ))}
    </tr>
  )
}

const LEGEND_SAMPLES: Record<Status, string> = {
  over: '▲ 45 / 40',
  full: '40 / 40',
  under: '30 / 40',
}

function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      {(Object.keys(LEGEND_SAMPLES) as Status[]).map((status) => (
        <li key={status}>
          <span className={`cell cell--${status}`}>{LEGEND_SAMPLES[status]}</span>{' '}
          {STATUS_TEXT[status]}
        </li>
      ))}
      <li className="muted">Allocated hours / capacity, per week (Mon–Fri)</li>
    </ul>
  )
}
