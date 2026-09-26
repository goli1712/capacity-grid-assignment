import { useId, useState } from 'react'
import type { SetRange } from './useUrlRange'
import { defaultRange, expandRange, rangeError, sameRange, shiftRange, type Range } from './weeks'

type Props = {
  range: Range
  onChange: SetRange
}

export function RangeControls({ range, onChange }: Props) {
  const errorId = useId()
  const [draft, setDraft] = useState(range)
  const [synced, setSynced] = useState(range)

  // Arrows, Today and back/forward change the range from outside: reset the
  // inputs then. A change the inputs committed themselves keeps the typed
  // mid-week date, so the field doesn't jump to a Monday while being edited.
  if (!sameRange(synced, range)) {
    setSynced(range)
    if (rangeError(draft) || !sameRange(expandRange(draft), range)) setDraft(range)
  }

  const error = rangeError(draft)
  const rangeValid = rangeError(range) === null

  // Date inputs fire on every typed segment; replace so Back skips keystrokes.
  function edit(next: Range) {
    setDraft(next)
    if (!rangeError(next)) onChange(next, { replace: true })
  }

  function reset() {
    setDraft(defaultRange())
    onChange(null)
  }

  return (
    <div className="range-controls">
      <div className="range-step" role="group" aria-label="Move by week">
        <button
          type="button"
          aria-label="Previous week"
          disabled={!rangeValid}
          onClick={() => onChange(shiftRange(range, -1))}
        >
          ‹
        </button>
        <button type="button" onClick={reset}>
          Today
        </button>
        <button
          type="button"
          aria-label="Next week"
          disabled={!rangeValid}
          onClick={() => onChange(shiftRange(range, 1))}
        >
          ›
        </button>
      </div>
      <label>
        From{' '}
        <input
          type="date"
          value={draft.from}
          aria-invalid={error !== null}
          aria-describedby={errorId}
          onChange={(e) => edit({ ...draft, from: e.target.value })}
        />
      </label>
      <label>
        To{' '}
        <input
          type="date"
          value={draft.to}
          aria-invalid={error !== null}
          aria-describedby={errorId}
          onChange={(e) => edit({ ...draft, to: e.target.value })}
        />
      </label>
      <p id={errorId} className="range-error" aria-live="polite">
        {error}
      </p>
    </div>
  )
}
