import { memo, useMemo, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PersonCapacity } from './api'
import { CapacityEditor } from './CapacityEditor'
import { capacityQuery, useSaveCapacity, type SaveFailure } from './capacityCache'
import { hoursFormat } from './format'
import { expandRange, formatWeek, mondaysIn, sameRange, type Range } from './weeks'

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

const byName = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

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
  const requested = expandRange({ from, to })
  const current = useQuery({ ...capacityQuery(requested), placeholderData: keepPreviousData })

  // A failed fetch drops the placeholder, so remember the last range that
  // loaded and keep observing its cache entry to show it as stale.
  const [lastGood, setLastGood] = useState<Range | null>(null)
  if (current.data && !current.isPlaceholderData && !(lastGood && sameRange(lastGood, requested))) {
    setLastGood(requested)
  }
  const fallback = useQuery({ ...capacityQuery(lastGood ?? requested), enabled: false })

  // The placeholder is a snapshot, so a capacity saved while the new range
  // loads would not show in it; the fallback observes the live cache entry.
  const data = (current.isPlaceholderData ? undefined : current.data) ?? fallback.data
  const loadedAt = current.data ? current.dataUpdatedAt : fallback.dataUpdatedAt
  const stale = current.error !== null
  const updating = !stale && (current.isPlaceholderData || !current.data)
  const retry = () => void current.refetch()

  const people = useMemo(
    () => (data ? [...data.people].sort((a, b) => byName.compare(a.name, b.name)) : []),
    [data],
  )

  if (!data) {
    if (current.error) {
      return (
        <LoadError retrying={current.isFetching} onRetry={retry}>
          Could not load capacity for {requested.from} to {requested.to}: {current.error.message}
        </LoadError>
      )
    }
    return <GridSkeleton weeks={mondaysIn(requested)} />
  }

  return (
    <>
      {current.error && (
        <LoadError retrying={current.isFetching} onRetry={retry}>
          <strong>Stale.</strong> Could not load capacity for {requested.from} to {requested.to}:{' '}
          {current.error.message}. Showing {data.from} to {data.to} as loaded at{' '}
          {timeFormat.format(loadedAt)}.
        </LoadError>
      )}
      <div className="grid-bar">
        <Legend />
        <p className="updating" role="status">
          {updating && 'Updating…'}
        </p>
      </div>
      {people.length === 0 ? (
        <p className="empty">
          No people to show for {data.from} to {data.to}.
        </p>
      ) : (
        <div className="grid-scroll" aria-busy={updating} data-stale={stale}>
          <table className="grid">
            <caption className="visually-hidden">
              Allocated hours against weekly capacity, {data.from} to {data.to}
              {stale && ', stale'}
            </caption>
            <GridHead weeks={data.weeks} />
            <tbody>
              {people.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function GridHead({ weeks }: { weeks: string[] }) {
  return (
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
        {weeks.map((monday) => {
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
  )
}

const SKELETON_ROWS = 12

function GridSkeleton({ weeks }: { weeks: string[] }) {
  return (
    <>
      <div className="grid-bar">
        <Legend />
        <p className="updating" role="status">
          Loading capacity…
        </p>
      </div>
      <div className="grid-scroll" aria-busy="true">
        <table className="grid" aria-hidden="true">
          <GridHead weeks={weeks} />
          <tbody>
            {Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <tr key={row}>
                <th className="name">
                  <span className="bone" style={{ width: `${6 + ((row * 3) % 5)}rem` }} />
                </th>
                <td className="num">
                  <span className="bone" />
                </td>
                <td className="num">
                  <span className="bone" />
                </td>
                {weeks.map((monday) => (
                  <td key={monday} className="cell">
                    <span className="bone" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function LoadError({
  retrying,
  onRetry,
  children,
}: {
  retrying: boolean
  onRetry: () => void
  children: ReactNode
}) {
  return (
    <div className="load-error" role="alert">
      <p>{children}</p>
      <button type="button" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
}

const PersonRow = memo(function PersonRow({ person }: { person: PersonCapacity }) {
  const { save, saving, failure, retry, dismiss } = useSaveCapacity(person.id)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const statuses = person.allocated.map((a) => statusOf(a, person.capacity))
  const weeksOver = statuses.filter((s) => s === 'over').length

  // Retry and Dismiss remove the error row, so focus moves to the capacity
  // it was about instead of falling back to the page.
  function focusCapacity() {
    rowRef.current?.querySelector<HTMLElement>('.capacity-value')?.focus()
  }

  return (
    <>
      <tr ref={rowRef} data-save-failed={failure !== null}>
        <th scope="row" className="name">
          <span dir="auto">{person.name}</span>
        </th>
        <td className="num">
          <CapacityEditor name={person.name} capacity={person.capacity} saving={saving} onSave={save} />
        </td>
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
      {failure && (
        <SaveError
          failure={failure}
          name={person.name}
          lastSaved={person.capacity}
          colSpan={person.allocated.length + 3}
          onRetry={() => {
            retry()
            focusCapacity()
          }}
          onDismiss={() => {
            dismiss()
            focusCapacity()
          }}
        />
      )}
    </>
  )
})

function SaveError({
  failure,
  name,
  lastSaved,
  colSpan,
  onRetry,
  onDismiss,
}: {
  failure: SaveFailure
  name: string
  lastSaved: number
  colSpan: number
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <tr className="save-error-row">
      <td colSpan={colSpan}>
        <div className="save-error">
          <p role="alert">
            Couldn't save {hoursFormat.format(failure.attempted)} h for <bdi>{name}</bdi>: {failure.reason}.
            Showing the last saved {hoursFormat.format(lastSaved)} h.
          </p>
          <button type="button" onClick={onRetry}>
            Retry<span className="visually-hidden"> saving {name}</span>
          </button>
          <button type="button" onClick={onDismiss}>
            Dismiss<span className="visually-hidden"> error for {name}</span>
          </button>
        </div>
      </td>
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
