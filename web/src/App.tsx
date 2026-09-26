import { CapacityGrid } from './CapacityGrid'
import { RangeControls } from './RangeControls'
import { useUrlRange } from './useUrlRange'
import { expandRange, rangeError } from './weeks'

export function App() {
  // The range the grid loads. Widen it if you want to see more.
  const [range, setRange] = useUrlRange()
  const weekRange = rangeError(range) === null ? expandRange(range) : null
  return (
    <main>
      <h1>Team capacity</h1>
      <p className="range">{weekRange && `${weekRange.from} to ${weekRange.to}`}</p>
      <RangeControls range={range} onChange={setRange} />
      {weekRange && <CapacityGrid from={weekRange.from} to={weekRange.to} />}
    </main>
  )
}
