import { CapacityGrid } from './CapacityGrid'
import { RangeControls } from './RangeControls'
import { useUrlRange } from './useUrlRange'
import { expandRange, formatRange, mondaysIn, rangeError } from './weeks'

export function App() {
  // The range the grid loads. Widen it if you want to see more.
  const [range, setRange] = useUrlRange()
  const weekRange = rangeError(range) === null ? expandRange(range) : null
  const weekCount = weekRange ? mondaysIn(weekRange).length : 0
  return (
    <main>
      <header className="toolbar">
        <div className="toolbar-title">
          <h1>Team capacity</h1>
          <p className="range">
            {weekRange && (
              <>
                <span>{formatRange(weekRange)}</span>
                <span className="range-weeks">
                  {weekCount} {weekCount === 1 ? 'week' : 'weeks'}
                </span>
              </>
            )}
          </p>
        </div>
        <RangeControls range={range} onChange={setRange} />
      </header>
      {weekRange && <CapacityGrid from={weekRange.from} to={weekRange.to} />}
    </main>
  )
}
