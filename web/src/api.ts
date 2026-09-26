export type Person = {
  id: number
  name: string
  capacity: number
}

export type PersonCapacity = Person & {
  allocated: number[]
}

export type CapacityResponse = {
  from: string
  to: string
  weeks: string[]
  people: PersonCapacity[]
}

export async function fetchCapacity(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CapacityResponse> {
  const params = new URLSearchParams({ from, to })
  const res = await fetch(`/api/capacity?${params}`, { signal })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json()
}

export async function updateCapacity(id: number, capacity: number): Promise<Person> {
  let res: Response
  try {
    res = await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    })
  } catch {
    throw new Error('network error')
  }
  if (res.status >= 500) throw new Error('server unavailable')
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json()
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // Not JSON (a proxy error page, say); fall through to the status.
  }
  return `Request failed (${res.status} ${res.statusText})`
}
