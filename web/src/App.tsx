import { CapacityGrid } from './CapacityGrid'
import { defaultRange } from './weeks'

export function App() {
  // The range the grid loads. Widen it if you want to see more.
  const { from, to } = defaultRange()
  return (
    <main>
      <h1>Team capacity</h1>
      <p className="range">
        {from} to {to}
      </p>
      <CapacityGrid from={from} to={to} />
    </main>
  )
}
