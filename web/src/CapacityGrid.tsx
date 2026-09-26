import {
  memo,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PersonCapacity } from './api'
import { CapacityEditor } from './CapacityEditor'
import { capacityQuery, useSaveCapacity, useUnresolvedSaves, type SaveFailure } from './capacityCache'
import { hoursFormat } from './format'
import { STATUS_TEXT, statusOf, type Status } from './status'
import { WeekTooltip, type CellPosition, type WeekTooltipHandle } from './WeekTooltip'
import { currentWeek, expandRange, formatWeek, mondaysIn, sameRange, type Range } from './weeks'

type Props = {
  from: string
  to: string
}

function isOverAllocated(person: PersonCapacity): boolean {
  return person.allocated.some((allocated) => statusOf(allocated, person.capacity) === 'over')
}

function weekCellOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('td[data-col]') : null
}

function personRowOf(cell: HTMLElement): HTMLTableRowElement | null {
  return cell.closest<HTMLTableRowElement>('tr[data-person]')
}

function cellPosition(cell: HTMLElement): CellPosition | null {
  const row = personRowOf(cell)
  return row ? { personId: Number(row.dataset.person), col: Number(cell.dataset.col) } : null
}

// Skips the save-error rows that sit between people.
function adjacentPersonRow(row: HTMLTableRowElement, step: -1 | 1): HTMLTableRowElement | null {
  let next = step < 0 ? row.previousElementSibling : row.nextElementSibling
  while (next && !(next instanceof HTMLTableRowElement && next.dataset.person)) {
    next = step < 0 ? next.previousElementSibling : next.nextElementSibling
  }
  return next
}

function cellForKey(cell: HTMLElement, key: string): HTMLElement | null {
  const row = personRowOf(cell)
  if (!row) return null
  const col = Number(cell.dataset.col)
  const cellAt = (r: HTMLTableRowElement | null, c: number) =>
    r?.querySelector<HTMLElement>(`td[data-col="${c}"]`) ?? null
  switch (key) {
    case 'ArrowLeft':
      return cellAt(row, col - 1)
    case 'ArrowRight':
      return cellAt(row, col + 1)
    case 'ArrowUp':
      return cellAt(adjacentPersonRow(row, -1), col)
    case 'ArrowDown':
      return cellAt(adjacentPersonRow(row, 1), col)
    case 'Home':
      return cellAt(row, 0)
    case 'End':
      return row.querySelector<HTMLElement>('td[data-col]:last-of-type')
    default:
      return null
  }
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

  // The switch flips at once; the rows follow as a deferred render, since
  // turning the filter off can mount hundreds of rows.
  const [onlyOver, setOnlyOver] = useState(false)
  const deferredOnlyOver = useDeferredValue(onlyOver)
  const filterRef = useRef<HTMLInputElement>(null)
  // A person mid-save or with a failed save stays visible, so the saving
  // state and the Retry/Dismiss row can't be filtered away with them.
  const unresolvedSaves = useUnresolvedSaves()
  const visiblePeople = useMemo(
    () =>
      deferredOnlyOver ? people.filter((p) => isOverAllocated(p) || unresolvedSaves.has(p.id)) : people,
    [people, deferredOnlyOver, unresolvedSaves],
  )

  // The week cells share one tab stop; arrow keys move it.
  const [tabStop, setTabStop] = useState<CellPosition | null>(null)
  const tooltipRef = useRef<WeekTooltipHandle>(null)
  const tabPersonId = visiblePeople.some((p) => p.id === tabStop?.personId)
    ? tabStop?.personId
    : visiblePeople[0]?.id
  const tabCol = Math.max(0, Math.min(tabStop?.col ?? 0, (data?.weeks.length ?? 1) - 1))

  function onCellFocus(e: FocusEvent) {
    const cell = weekCellOf(e.target)
    const position = cell && cellPosition(cell)
    if (!cell || !position) return
    setTabStop((prev) => (prev?.personId === position.personId && prev.col === position.col ? prev : position))
    tooltipRef.current?.show(cell, position, 'focus')
  }

  function onCellKeyDown(e: KeyboardEvent) {
    const cell = weekCellOf(e.target)
    const next = cell && cellForKey(cell, e.key)
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  function onPointerOver(e: PointerEvent) {
    const cell = weekCellOf(e.target)
    const position = cell && cellPosition(cell)
    if (cell && position) tooltipRef.current?.show(cell, position, 'hover')
    else tooltipRef.current?.hide('hover')
  }

  function showEveryone() {
    setOnlyOver(false)
    filterRef.current?.focus()
  }

  let countLabel: string | null = null
  if (data) {
    countLabel = deferredOnlyOver ? `${visiblePeople.length} of ${people.length} people` : `${people.length} people`
  }
  const filterControl = (
    <OverFilter ref={filterRef} checked={onlyOver} onChange={setOnlyOver}>
      {countLabel}
    </OverFilter>
  )

  if (!data) {
    if (current.error) {
      return (
        <LoadError retrying={current.isFetching} onRetry={retry}>
          Could not load capacity for {requested.from} to {requested.to}: {current.error.message}
        </LoadError>
      )
    }
    return <GridSkeleton weeks={mondaysIn(requested)} filterControl={filterControl} />
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
      <GridBar status={updating && 'Updating…'}>{filterControl}</GridBar>
      {people.length === 0 ? (
        <p className="empty">
          No people to show for {data.from} to {data.to}.
        </p>
      ) : visiblePeople.length === 0 ? (
        <div className="empty" aria-busy={updating} data-stale={stale}>
          <p>
            Nobody is over-allocated from {data.from} to {data.to}.
          </p>
          <button type="button" onClick={showEveryone}>
            Show everyone
          </button>
        </div>
      ) : (
        <div
          className="grid-scroll"
          aria-busy={updating}
          data-stale={stale}
          onFocus={onCellFocus}
          onBlur={() => tooltipRef.current?.hide('focus')}
          onKeyDown={onCellKeyDown}
          onPointerOver={onPointerOver}
          onPointerLeave={() => tooltipRef.current?.hide('hover')}
          onScroll={() => tooltipRef.current?.reposition()}
        >
          <table className="grid">
            <caption className="visually-hidden">
              Allocated hours against weekly capacity, {data.from} to {data.to}
              {stale && ', stale'}
            </caption>
            <GridHead weeks={data.weeks} />
            <tbody>
              {visiblePeople.map((person) => (
                <PersonRow key={person.id} person={person} tabCol={person.id === tabPersonId ? tabCol : null} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WeekTooltip ref={tooltipRef} people={visiblePeople} weeks={data.weeks} />
    </>
  )
}

function GridHead({ weeks }: { weeks: string[] }) {
  const thisWeek = currentWeek()
  return (
    <thead>
      <tr>
        <th scope="col" className="name">
          Person
        </th>
        <th scope="col" className="num">
          Capacity
          <span className="th-hint" aria-hidden="true">
            Editable
          </span>
        </th>
        <th scope="col" className="num">
          Weeks over
        </th>
        {weeks.map((monday, i) => {
          const { label, year } = formatWeek(monday)
          const now = monday === thisWeek
          return (
            <th
              scope="col"
              key={monday}
              className={now ? 'week week--now' : 'week'}
              aria-current={now ? 'date' : undefined}
            >
              <span className="week-ordinal" aria-hidden="true">
                Week {i + 1}
                {now && <span className="week-now">Now</span>}
              </span>
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

function GridBar({ status, children }: { status: ReactNode; children: ReactNode }) {
  return (
    <div className="grid-bar">
      <Legend />
      <div className="grid-tools">
        <p className="updating" role="status">
          {status}
        </p>
        {children}
      </div>
    </div>
  )
}

function GridSkeleton({ weeks, filterControl }: { weeks: string[]; filterControl: ReactNode }) {
  return (
    <>
      <GridBar status="Loading capacity…">{filterControl}</GridBar>
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

function OverFilter({
  ref,
  checked,
  onChange,
  children,
}: {
  ref: Ref<HTMLInputElement>
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <div className="over-filter">
      <label>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        Only over-allocated
      </label>
      <span className="filter-count" role="status">
        {children}
      </span>
    </div>
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

const PersonRow = memo(function PersonRow({ person, tabCol }: { person: PersonCapacity; tabCol: number | null }) {
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
      <tr ref={rowRef} data-person={person.id} data-save-failed={failure !== null}>
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
          <td key={i} className={`cell cell--${statuses[i]}`} data-col={i} tabIndex={i === tabCol ? 0 : -1}>
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
