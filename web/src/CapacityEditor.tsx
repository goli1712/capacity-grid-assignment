import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { hoursFormat } from './format'

const MAX_CAPACITY = 168

type Props = {
  name: string
  capacity: number
  saving: boolean
  onSave: (capacity: number) => void
}

type Parsed = { capacity: number; error: null } | { capacity: null; error: string }

// Mirrors the server's 400s, so an invalid capacity is never sent.
// A comma is accepted as the decimal separator.
function parseCapacity(raw: string): Parsed {
  const text = raw.trim().replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) {
    return { capacity: null, error: 'Enter hours as a number, like 37.5.' }
  }
  const capacity = Number(text)
  if (capacity < 0) return { capacity: null, error: "Capacity can't be negative." }
  if (capacity > MAX_CAPACITY) {
    return { capacity: null, error: `Capacity can't exceed ${MAX_CAPACITY} hours a week.` }
  }
  if (!Number.isInteger(capacity * 2)) {
    return { capacity: null, error: 'Use whole or half hours, like 37.5.' }
  }
  return { capacity, error: null }
}

export function CapacityEditor({ name, capacity, saving, onSave }: Props) {
  const hintId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Set when Enter or Esc closes the editor, so the blur that follows is
  // ignored and focus goes back to the button.
  const closedByKey = useRef(false)

  function open() {
    if (saving) return
    setDraft(String(capacity))
    setError(null)
  }

  function close() {
    setDraft(null)
    setError(null)
  }

  function commit(): boolean {
    if (draft === null) return false
    const parsed = parseCapacity(draft)
    if (parsed.error !== null) {
      setError(parsed.error)
      return false
    }
    close()
    if (parsed.capacity !== capacity) onSave(parsed.capacity)
    return true
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      closedByKey.current = commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closedByKey.current = true
      close()
    }
  }

  function onBlur() {
    if (closedByKey.current) return
    commit()
  }

  function focusAfterKey(button: HTMLButtonElement | null) {
    if (button && closedByKey.current) {
      closedByKey.current = false
      button.focus()
    }
  }

  if (draft === null) {
    return (
      <span className="capacity">
        {saving && (
          <span className="saving" aria-hidden="true">
            Saving…
          </span>
        )}
        <button
          ref={focusAfterKey}
          type="button"
          className="capacity-value"
          aria-label={`Capacity for ${name}: ${hoursFormat.format(capacity)} hours${saving ? ', saving' : ', edit'}`}
          aria-disabled={saving}
          onClick={open}
        >
          {hoursFormat.format(capacity)} h
        </button>
      </span>
    )
  }

  return (
    <span className="capacity">
      <input
        className="capacity-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        aria-label={`Capacity for ${name}, in hours a week`}
        aria-invalid={error !== null}
        aria-describedby={hintId}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      <span aria-hidden="true"> h</span>
      <span id={hintId} className="capacity-hint" role="alert">
        {error}
      </span>
    </span>
  )
}
