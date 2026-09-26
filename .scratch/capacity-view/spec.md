# Capacity view

Status: ready-for-agent

## Problem Statement

A manager needs to know who is over-allocated in a week before that week starts, not after. Today there's no view of a person's allocated hours against their capacity, week by week. The capacity endpoint, the grid, and the capacity edit are all stubs. When a manager learns that someone's capacity has changed (a move to part-time, say), there's no way to record it and immediately see what that does to their weeks.

In production the view serves rosters of a few thousand people and up to two years of history, so it has to stay scoped and responsive, and it has to stay honest while data is loading, arriving late, or failing to save.

## Solution

A capacity grid with people down the side and weeks across the top. Each cell shows a person's allocated hours against their capacity for that week, with over-allocated weeks obvious at a glance. The manager moves through time a week at a time or picks a date range. They edit a person's capacity inline. The grid reflects the change immediately, and if the save fails it reverts and says so plainly, with a way to retry.

## User Stories

1. As a manager, I want to see every person as a row and every week as a column, so that I can scan the team's commitments across time.
2. As a manager, I want each cell to show allocated hours and capacity in hours (e.g. "45 / 40"), so that I can see the size of the gap, not just that one exists.
3. As a manager, I want over-allocated weeks to stand out strongly, so that I can spot over-commitment at a glance.
4. As a manager, I want fully allocated weeks to look different from both under- and over-allocated weeks, so that I can tell "exactly full" apart from "has room".
5. As a manager with colour-vision deficiency, I want over-allocation marked by something other than colour alone, so that I can still spot it.
6. As a manager, I want a person with zero capacity and any allocation to show as over-allocated (e.g. "20 / 0"), so that work assigned to someone unavailable is never hidden.
7. As a manager, I want a person with zero capacity and no allocation to show as neither over- nor under-allocated in any alarming way, so that the grid doesn't cry wolf.
8. As a manager, I want each row to show how many of the visible weeks the person is over-allocated, so that I can rank who needs attention.
9. As a manager, I want allocated hours to count only working days (Monday to Friday), so that an assignment that nominally runs through a weekend doesn't inflate a week.
10. As a manager, I want each column to be one whole ISO week labelled by its Monday, so that every column is comparable with every other.
11. As a manager, I want the grid to open on the current week and the seven weeks after it, so that I see what's coming by default.
12. As a manager, I want to step the whole window back one week, so that I can look at recent history.
13. As a manager, I want to step the whole window forward one week, so that I can look further ahead.
14. As a manager, I want a "Today" control, so that I can get back to the current week after navigating away.
15. As a manager, I want to choose a From and a To date, so that I can look at a specific span.
16. As a manager, I want dates I choose mid-week to expand to whole weeks, so that I never see a partial week.
17. As a manager, I want to be told inline when To is before From, and have nothing requested until I fix it, so that I don't get a confusing empty or broken grid.
18. As a manager, I want to be told inline when the range is longer than 26 weeks, so that I understand the limit instead of waiting on a huge load.
19. As a manager, I want the chosen range reflected in the URL, so that I can share the exact view or reload without losing it.
20. As a manager, I want a skeleton grid on first load, so that I know data is coming and the layout doesn't jump.
21. As a manager, I want the previous grid to stay visible but dimmed, with an "Updating…" indicator, while a new range loads, so that I keep my place and nothing flickers.
22. As a manager, I want a slow response for an old range never to replace the range I've since moved to, so that what I see always matches the range I chose.
23. As a manager, I want a clear error with a Retry when the grid fails to load, so that I can recover without reloading the page.
24. As a manager, I want the last good data to stay visible and be labelled as stale when a refresh fails, so that a blip doesn't wipe my view.
25. As a manager, I want a clear message when there's nobody to show, so that an empty grid isn't mistaken for a failure.
26. As a manager, I want people sorted by name in a locale-aware way, so that names with accents and non-Latin scripts land where I expect.
27. As a manager, I want names in right-to-left scripts to render correctly, so that every person on the team is legible.
28. As a manager, I want the name column and the week header to stay put while I scroll, so that I never lose track of who and when a cell refers to.
29. As a manager, I want an "Only over-allocated" toggle, so that I can focus on the people who need attention.
30. As a manager, I want to edit a person's capacity from their row, so that I can record a change without leaving the view.
31. As a manager, I want Enter or blur to save and Esc to cancel, so that editing is quick from the keyboard.
32. As a manager, I want the grid to reflect a new capacity immediately, including the over/full/under state of every week for that person, so that I see the consequence of my change at once.
33. As a manager, I want a "Saving…" indicator on the row while the save is in flight, so that I know it isn't confirmed yet.
34. As a manager, I want that person's edit control disabled while their save is in flight, so that I can't start two conflicting saves.
35. As a manager, I want to keep editing other people while one save is in flight, so that one slow save doesn't block me.
36. As a manager, I want an invalid capacity (not a number, negative, above 168, or not a multiple of 0.5) rejected inline before anything is sent, so that I fix it immediately.
37. As a manager, I want submitting an unchanged capacity to just close the editor, so that nothing is saved for no reason.
38. As a manager, when a save fails, I want the row to revert to the last saved capacity, so that the grid never shows a number that isn't true.
39. As a manager, when a save fails, I want an inline error on that row saying what I tried to save, for whom, and why it failed, so that I understand what didn't happen.
40. As a manager, I want Retry on a failed save that resends the value I tried, so that I don't have to retype it.
41. As a manager, I want Dismiss on a failed save, so that I can accept the revert and move on.
42. As a manager, I want a failed-save error to stay until I act on it, so that I don't miss it.
43. As a manager using a screen reader, I want save failures announced, so that I learn about them without looking.
44. As a manager, I want a capacity change to show correctly in weeks outside the current window when I navigate to them afterwards, so that the edit is consistent everywhere.
45. As a manager, I want a capacity change made while another range is loading not to be overwritten by that range's older data, so that my edit never silently disappears.
46. As a manager, I want the numbers to be correct after a save without a page reload, so that editing feels like part of the view.
47. As a future maintainer, I want capacity edits to apply to all weeks (there's no capacity history), and that to be written down, so that nobody is surprised that past weeks change too.
48. As an API consumer, I want the capacity endpoint to echo the whole-week range it actually used, so that I can label columns without redoing the date maths.
49. As an API consumer, I want clear 400 responses for missing, malformed, inverted, or over-long ranges, so that client bugs show up quickly.
50. As an API consumer, I want the capacity update to return the saved person, so that I can reconcile against what the server actually stored.
51. As an API consumer, I want a 404 for an unknown person and a 400 with a readable message for an invalid capacity, so that I can tell the manager what went wrong.

## Implementation Decisions

**Domain rules** (see `CONTEXT.md` for the terms and ADR 0001 for the reasoning)

- Allocated hours for a person in a week = the sum, over every assignment row overlapping the week, of `hours_per_day` × the number of working days (Mon–Fri) in the overlap between the assignment span and the week. Every row counts: no deduplication, no "latest row wins". The seed stores each logical assignment as 15 rows whose sum gives whole hours per day (ADR 0001).
- Weekends never carry allocation. Public holidays are not modelled.
- A week is an ISO week (Monday to Sunday), identified by its Monday.
- Capacity is the person's single current weekly figure and applies to every week, past and future. There is no history.
- Status per cell: over-allocated if allocated is strictly greater than capacity (so any allocation against zero capacity is over), fully allocated if they are equal, otherwise under. Display is in hours, never percentages.

**Capacity read API**

- `GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- The server expands `from` back to its Monday and `to` forward to its Sunday.
- 400 responses: a missing or malformed date, `to` before `from`, or more than 26 weeks after expansion.
- Response shape:
  ```
  {
    from: string,              // Monday of first week
    to: string,                // Sunday of last week
    weeks: string[],           // Mondays, ascending
    people: [{ id: number, name: string, capacity: number, allocated: number[] }]
  }
  ```
  `allocated[i]` corresponds to `weeks[i]` and is dense (0 where there's nothing). Capacity sits on the person, not in each week.
- Every person is returned, including people with no allocation in the range. Order doesn't matter; the client sorts.
- Aggregation happens in SQL, in one query scoped to assignments overlapping the range (`start_date <= to AND end_date >= from`), bucketed by week. No per-person or per-week round trips. Weeks come from a generated series so empty weeks exist. The SQL lives in the query, not assembled from strings in Go.

**Capacity update API**

- `PATCH /api/people/{id}` with body `{ capacity: number }`.
- Valid capacity: 0 to 168 inclusive, in steps of 0.5.
- Responses: 400 with a readable message for a malformed id, body or value; 404 for an unknown person; 200 with `{ id, name, capacity }` from a single update-returning statement.
- Last write wins. No concurrency control.

**Frontend**

- Add TanStack Query for fetching and mutations. Each range is its own cache entry keyed by its expanded `from`/`to`. Switching ranges keeps the previous data on screen, and requests for abandoned ranges are aborted.
- The range state lives in the URL query string. The default is the current ISO week plus the seven after it. The arrows shift the whole window by one week and "Today" resets it. From/To inputs expand to whole weeks. Invalid ranges are shown inline and no request is made.
- The client validates capacity with the same rules as the server.
- The capacity edit is optimistic:
  - Cancel in-flight range fetches.
  - Snapshot every cached range.
  - Write the new capacity for that person into every cached range.
  - On error, restore the snapshots and show the row's inline error.
  - On success, write the server's returned capacity into every cached range, and invalidate any range whose fetch was in flight during the save, so a response that started before the save can't leave the old capacity behind.
  - No full-range refetch after a save.
- Only one save can be in flight per person. Different people save independently.
- Failed-save errors are held per person until the manager retries or dismisses them, and are announced through a live region.
- Rows are sorted with a locale-aware collator. Names are rendered with automatic text direction. The name column and the week header are sticky.

## Testing Decisions

- Tests exercise external behaviour only: what the manager sees and what goes over the network. They never touch internal hooks, cache helpers or status functions directly, and nothing is exported just to be tested.
- **Frontend seam (the only one):** the rendered app in jsdom via React Testing Library, with `fetch` stubbed to script responses for the two endpoints: normal, delayed, out-of-order, 4xx/5xx, and network failure. This one seam covers:
  - the optimistic save across multiple cached ranges;
  - rollback and the inline error with Retry and Dismiss;
  - the navigate-during-save race;
  - over/full/under status, including zero capacity;
  - range expansion and inline validation.
- **Backend seam (deferred):** the real HTTP handlers against the seeded Postgres, run inside Compose. They assert the hand-checked values: Ana Ferreira 40/40 in the week of 2025-12-29, Dee Okafor 45/40 in the week of 2026-01-05, Eli Nakamura 20/0 in the week of 2026-01-05, plus the 400 and 404 paths.
- There are no existing tests in the repo to follow. Vitest, React Testing Library, jest-dom and jsdom are already installed, and `docker compose exec web npm test` runs them.
- This pass writes two tests through the frontend seam, both on the optimistic save because it's the part that's riskiest to change (`issues/07-vitest-coverage.md`): a failed save rolls back across cached ranges, and a late range response can't undo a successful save. Everything else in the seam list above, and the backend seam, is deferred. The rest is verified by hand: the three seed values above, checked in the running grid, and a failed save produced by stopping the API container and then editing.

## Out of Scope

- Row virtualization and server-side pagination or filtering by team (needed for thousands of people; deferred and noted).
- Search by name.
- Capacity history (per-week or effective-dated capacity).
- Concurrency control on edits (etag / If-Match). Last write wins.
- Public holidays and time off.
- Editing assignments. Only capacity is editable.
- The logged-time timeline and the wider team overview page this view will sit in.
- A fault-injection switch for demonstrating failed saves.
- Any change to the schema, seed, Compose files, Dockerfiles or Makefile.

## Further Notes

- The seed has several traps worth remembering: the 14+1 row pattern per assignment, 46,665 rows ending on a weekend, a person with zero capacity who still has work, and names in Arabic, Hebrew, Korean and Greek scripts.
- The seed runs from 2025-06-02 to 2027-01-03. Today's default window falls inside it.
- The design record is in `.notes/worklog.md` (2026-09-26 entry). `DECISIONS.md` is written by the human and must not be edited.
