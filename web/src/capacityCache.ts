import {
  queryOptions,
  useMutation,
  useMutationState,
  useQueryClient,
  type Query,
  type QueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
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

export type SaveFailure = {
  attempted: number
  reason: string
}

// Saves one person's capacity optimistically across every cached range.
// Only that person's capacity is written or rolled back, so saves for
// different people never clobber each other.
//
// A failed save stays in the mutation cache until it is retried, dismissed
// or replaced by a new save, so it survives the row unmounting.
export function useSaveCapacity(personId: number) {
  const client = useQueryClient()
  const mutationKey = [SAVE_KEY, personId]
  const { mutate } = useMutation<Person, Error, number, SaveContext>({
    mutationKey,
    scope: { id: `${SAVE_KEY}-${personId}` },
    gcTime: Infinity,
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
        // Capacity is one figure per person, so until that refetch lands (or
        // if it fails) they show the value snapshotted from any other range.
        const lastSaved = context?.previous.values().next().value
        for (const query of capacityQueries(client)) {
          const capacity = context?.previous.get(query.queryHash) ?? lastSaved
          if (!context?.previous.has(query.queryHash)) toRefetch.add(query)
          if (capacity !== undefined) {
            client.setQueryData<CapacityResponse>(query.queryKey, (data) => withCapacity(data, personId, capacity))
          }
        }
      }

      void client.invalidateQueries({ queryKey: CAPACITY_KEY, predicate: (q) => toRefetch.has(q) })
    },
  })

  const latest = useMutationState({
    filters: { mutationKey },
    select: ({ state }) => ({ status: state.status, capacity: state.variables as number, error: state.error }),
  }).at(-1)

  // Settled saves are only kept to show a failure, so drop them before the
  // next one; otherwise every save would stay cached forever.
  function dismiss() {
    const cache = client.getMutationCache()
    for (const mutation of cache.findAll({ mutationKey })) {
      if (mutation.state.status !== 'pending') cache.remove(mutation)
    }
  }

  function save(capacity: number) {
    dismiss()
    mutate(capacity)
  }

  const failure: SaveFailure | null =
    latest?.status === 'error' ? { attempted: latest.capacity, reason: latest.error?.message ?? 'unknown error' } : null

  return {
    save,
    saving: latest?.status === 'pending',
    failure,
    retry: () => {
      if (failure) save(failure.attempted)
    },
    dismiss,
  }
}

// People whose latest save is still in flight, or failed and hasn't been
// retried or dismissed yet.
export function useUnresolvedSaves(): Set<number> {
  const saves = useMutationState({
    filters: { mutationKey: [SAVE_KEY] },
    select: (mutation) => ({
      personId: mutation.options.mutationKey?.[1] as number,
      status: mutation.state.status,
    }),
  })
  return useMemo(() => {
    const latest = new Map(saves.map((save) => [save.personId, save.status]))
    return new Set([...latest].filter(([, status]) => status === 'pending' || status === 'error').map(([id]) => id))
  }, [saves])
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
