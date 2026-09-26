import '@testing-library/jest-dom/vitest'
import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'

const WEEK_A = '2026-01-05'
const WEEK_B = '2026-01-12'

type Hold = { released: Promise<void>; release: () => void }

function hold(): Hold {
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  return { released, release }
}

// A stand-in for the API with one-week ranges. Each response is built when the
// request arrives, so a held response carries the data as it was then.
function fakeServer() {
  const people = [
    { id: 1, name: 'Ana Ferreira', capacity: 40 },
    { id: 4, name: 'Dee Okafor', capacity: 40 },
  ]
  const allocated: Record<string, Record<number, number>> = {
    [WEEK_A]: { 1: 40, 4: 45 },
    [WEEK_B]: { 1: 40, 4: 40 },
  }
  const capacityHolds = new Map<string, Hold>()
  let patchHold: Hold | null = null

  const server = {
    failPatches: false,
    // Holds the next capacity response for the range starting on `from`.
    holdNextRange(from: string): Hold {
      const h = hold()
      capacityHolds.set(from, h)
      return h
    },
    holdNextPatch(): Hold {
      patchHold = hold()
      return patchHold
    },
    fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), 'http://localhost')

      if (url.pathname === '/api/capacity') {
        const from = url.searchParams.get('from') ?? ''
        const body = {
          from,
          to: url.searchParams.get('to'),
          weeks: [from],
          people: people.map((p) => ({ ...p, allocated: [allocated[from]?.[p.id] ?? 0] })),
        }
        const held = capacityHolds.get(from)
        capacityHolds.delete(from)
        await held?.released
        return Response.json(body)
      }

      const id = Number(url.pathname.match(/^\/api\/people\/(\d+)$/)?.[1])
      const person = people.find((p) => p.id === id)
      if (person && init?.method === 'PATCH') {
        const { capacity } = JSON.parse(String(init.body)) as { capacity: number }
        const held = patchHold
        patchHold = null
        await held?.released
        if (server.failPatches) return Response.json({ error: 'database unavailable' }, { status: 500 })
        person.capacity = capacity
        return Response.json(person)
      }

      return Response.json({ error: 'not found' }, { status: 404 })
    }),
  }
  return server
}

let server: ReturnType<typeof fakeServer>

beforeEach(() => {
  server = fakeServer()
  vi.stubGlobal('fetch', server.fetch)
  window.history.replaceState(null, '', `/?from=${WEEK_A}&to=2026-01-11`)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp() {
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

function showsWeek(monday: string) {
  return screen.findByRole('table', { name: new RegExp(`, ${monday} to `) })
}

// The one week cell in a person's row, as a screen reader reads it.
function weekCell(name: string) {
  const row = screen.getByRole('rowheader', { name }).closest('tr')
  if (!row) throw new Error(`no row for ${name}`)
  return within(row).getAllByRole('cell').at(-1)
}

function capacityButton(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^Capacity for ${name}:`) })
}

function editCapacity(name: string, hours: string) {
  fireEvent.click(capacityButton(name))
  const input = screen.getByRole('textbox', { name: `Capacity for ${name}, in hours a week` })
  fireEvent.change(input, { target: { value: hours } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

test('a failed save rolls back in every cached range, and Retry then saves it everywhere', async () => {
  renderApp()
  await showsWeek(WEEK_A)
  expect(weekCell('Dee Okafor')).toHaveTextContent('▲ 45 / 40, Over-allocated')

  fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
  await showsWeek(WEEK_B)
  expect(weekCell('Dee Okafor')).toHaveTextContent('40 / 40, Fully allocated')

  server.failPatches = true
  const patch = server.holdNextPatch()
  editCapacity('Dee Okafor', '45')
  await waitFor(() =>
    expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 45 hours, saving'),
  )
  expect(weekCell('Dee Okafor')).toHaveTextContent('40 / 45, Has room')

  patch.release()
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't save 45 h for Dee Okafor: server unavailable. Showing the last saved 40 h.",
    ),
  )
  expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 40 hours, edit')
  expect(weekCell('Dee Okafor')).toHaveTextContent('40 / 40, Fully allocated')

  // Hold the refetch on the way back, so the first range shows what was cached.
  const refetchA = server.holdNextRange(WEEK_A)
  fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
  await showsWeek(WEEK_A)
  expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 40 hours, edit')
  expect(weekCell('Dee Okafor')).toHaveTextContent('▲ 45 / 40, Over-allocated')
  refetchA.release()

  server.failPatches = false
  fireEvent.click(screen.getByRole('button', { name: /^Retry ?saving Dee Okafor$/ }))
  await waitFor(() =>
    expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 45 hours, edit'),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(weekCell('Dee Okafor')).toHaveTextContent('45 / 45, Fully allocated')

  fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
  await showsWeek(WEEK_B)
  expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 45 hours, edit')
  expect(weekCell('Dee Okafor')).toHaveTextContent('40 / 45, Has room')
})

test('a range response that arrives after a save cannot undo it', async () => {
  renderApp()
  await showsWeek(WEEK_A)

  const lateB = server.holdNextRange(WEEK_B)
  fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
  await waitFor(() =>
    expect(server.fetch).toHaveBeenCalledWith(expect.stringContaining(`from=${WEEK_B}`), expect.anything()),
  )

  editCapacity('Dee Okafor', '45')
  await waitFor(() =>
    expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 45 hours, edit'),
  )

  // The held response was built before the save, so it still says 40.
  await act(async () => {
    lateB.release()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  await showsWeek(WEEK_B)
  expect(capacityButton('Dee Okafor')).toHaveAccessibleName('Capacity for Dee Okafor: 45 hours, edit')
  expect(weekCell('Dee Okafor')).toHaveTextContent('40 / 45, Has room')
})
