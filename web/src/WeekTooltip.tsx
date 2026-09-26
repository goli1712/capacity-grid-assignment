import { useEffect, useEffectEvent, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import type { PersonCapacity } from './api'
import { hoursFormat } from './format'
import { STATUS_TEXT, statusOf } from './status'
import { formatWorkWeek } from './weeks'

export type CellPosition = { personId: number; col: number }

type TooltipSource = 'hover' | 'focus'

export type WeekTooltipHandle = {
  show: (cell: HTMLElement, position: CellPosition, source: TooltipSource) => void
  hide: (source: TooltipSource) => void
  reposition: () => void
}

type Tip = CellPosition & { cell: HTMLElement }

type Props = {
  ref: Ref<WeekTooltipHandle>
  people: PersonCapacity[]
  weeks: string[]
}

const GAP = 6
const EDGE = 8

function headroomLabel(allocated: number, capacity: number): string {
  switch (statusOf(allocated, capacity)) {
    case 'over':
      return `${hoursFormat.format(allocated - capacity)} h over`
    case 'full':
      return STATUS_TEXT.full
    case 'under':
      return `${hoursFormat.format(capacity - allocated)} h free`
  }
}

// One tooltip for the whole grid, so hovering across cells never re-renders
// the rows. It repeats what the cell's screen-reader text already says, so
// it is hidden from assistive technology. The hovered cell wins over the
// focused one, and the focused cell's tip comes back once the pointer leaves.
export function WeekTooltip({ ref, people, weeks }: Props) {
  const [tips, setTips] = useState<Record<TooltipSource, Tip | null>>({ hover: null, focus: null })
  const tip = tips.hover ?? tips.focus
  const boxRef = useRef<HTMLDivElement>(null)

  function place() {
    const box = boxRef.current
    if (!box || !tip?.cell.isConnected) return
    const cell = tip.cell.getBoundingClientRect()
    const { width, height } = box.getBoundingClientRect()
    let top = cell.bottom + GAP
    if (top + height > window.innerHeight - EDGE) top = cell.top - height - GAP
    const left = Math.min(Math.max(cell.right - width, EDGE), window.innerWidth - width - EDGE)
    box.style.translate = `${Math.round(left)}px ${Math.round(Math.max(top, EDGE))}px`
  }

  useImperativeHandle(ref, () => ({
    show(cell, position, source) {
      setTips((prev) => (prev[source]?.cell === cell ? prev : { ...prev, [source]: { ...position, cell } }))
    },
    hide(source) {
      setTips((prev) => (prev[source] ? { ...prev, [source]: null } : prev))
    },
    reposition: place,
  }))

  useLayoutEffect(place)

  const onResize = useEffectEvent(place)
  const open = tip !== null
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTips({ hover: null, focus: null })
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const person = tip && people.find((p) => p.id === tip.personId)
  const monday = tip && weeks[tip.col]
  const allocated = tip && person?.allocated[tip.col]
  if (!tip || !person || !monday || allocated == null) return null

  const status = statusOf(allocated, person.capacity)
  return (
    <div ref={boxRef} className="week-tip" data-status={status} aria-hidden="true">
      <p className="week-tip-name">
        <bdi>{person.name}</bdi>
      </p>
      <p className="week-tip-week">
        Week {tip.col + 1}, {formatWorkWeek(monday)}
      </p>
      <p className="week-tip-hours">
        <strong>{hoursFormat.format(allocated)} h</strong> of {hoursFormat.format(person.capacity)} h
      </p>
      <p className="week-tip-diff">
        {status === 'over' && '▲ '}
        {headroomLabel(allocated, person.capacity)}
      </p>
    </div>
  )
}
