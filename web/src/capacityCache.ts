import {
  queryOptions,
  useMutation,
  type Query,
  type QueryClient,
} from '@tanstack/react-query'
import { fetchCapacity, updateCapacity, type CapacityResponse, type Person } from './api'
import type { Range } from './weeks'

const CAPACITY_KEY = ['capacity'] as const
const SAVE_KEY = 'save-capacity'

export function capacityQuery(range: Range) {
  return queryOptions({
    queryKey: [...CAPACITY_KEY, range.from, range.to],
    queryFn: async ({ client, signal }) =>
      withPendingSaves(client, await fetchCapacity(range.from, range.to, signal)),
  })
}

type SaveContext = {
  // The person's capacity in each cached range before the optimistic write,
  // keyed by query hash.
  previous: Map<string, number>
  // Ranges whose fetch was cancelled to make room for the optimistic write.
  interrupted: Query[]
}

// Saves one person's capacity optimistically across every cached range.
// Only that person's capacity is written or rolled back, so saves for
// different people never clobber each other.
export function useSaveCapacity(personId: number) {
  return useMutation<Person, Error, number, SaveContext>({
    mutationKey: [SAVE_KEY, personId],
    scope: { id: `${SAVE_KEY}-${personId}` },
    mutationFn: (capacity) => updateCapacity(personId, capacity),
    onMutate: async (capacity, { client }) => {
      const interrupted = inFlight(client)
      await client.cancelQueries({ queryKey: CAPACITY_KEY })

      const previous = new Map<string, number>()
      for (const query of capacityQueries(client)) {
        const data = query.state.data as CapacityResponse | undefined
        const person = data?.people.find((p) => p.id === personId)
        if (person) previous.set(query.queryHash, person.capacity)
      }
      writeCapacity(client, personId, capacity)
      return { previous, interrupted }
    },
    onSettled: async (saved, _error, _capacity, context, { client }) => {
      // A range response that started before the save committed may carry the
      // old capacity: cancel it, fix the cache, then fetch it again.
      const toRefetch = new Set([...(context?.interrupted ?? []), ...inFlight(client)])
      await client.cancelQueries({ queryKey: CAPACITY_KEY, fetchStatus: 'fetching' })

      if (saved) {
        writeCapacity(client, personId, saved.capacity)
      } else {
        // Ranges that loaded during the save were given the optimistic value
        // and have nothing to restore to, so they are fetched again instead.
        for (const query of capacityQueries(client)) {
          const capacity = context?.previous.get(query.queryHash)
          if (capacity === undefined) toRefetch.add(query)
          else client.setQueryData<CapacityResponse>(query.queryKey, (data) => withCapacity(data, personId, capacity))
        }
      }

      void client.invalidateQueries({ queryKey: CAPACITY_KEY, predicate: (q) => toRefetch.has(q) })
    },
  })
}

function capacityQueries(client: QueryClient): Query[] {
  return client.getQueryCache().findAll({ queryKey: CAPACITY_KEY })
}

function inFlight(client: QueryClient): Query[] {
  return client.getQueryCache().findAll({ queryKey: CAPACITY_KEY, fetchStatus: 'fetching' })
}

// A range fetched mid-save may have read the old capacity, so the saves still
// in flight are laid over it, oldest first.
function withPendingSaves(client: QueryClient, data: CapacityResponse): CapacityResponse {
  const pending = client
    .getMutationCache()
    .findAll({ mutationKey: [SAVE_KEY], status: 'pending' })
    .sort((a, b) => a.state.submittedAt - b.state.submittedAt)
  let result = data
  for (const save of pending) {
    result = replaceCapacity(result, save.options.mutationKey?.[1] as number, save.state.variables as number)
  }
  return result
}

function writeCapacity(client: QueryClient, personId: number, capacity: number) {
  client.setQueriesData<CapacityResponse>({ queryKey: CAPACITY_KEY }, (data) =>
    withCapacity(data, personId, capacity),
  )
}

function withCapacity(
  data: CapacityResponse | undefined,
  personId: number,
  capacity: number,
): CapacityResponse | undefined {
  return data && replaceCapacity(data, personId, capacity)
}

// Other people keep their object identity so their memoized rows skip rendering.
function replaceCapacity(data: CapacityResponse, personId: number, capacity: number): CapacityResponse {
  return {
    ...data,
    people: data.people.map((p) => (p.id === personId ? { ...p, capacity } : p)),
  }
}
