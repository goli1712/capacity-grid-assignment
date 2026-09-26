# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

## 2026-09-26: design session, before any code

Terms are in `CONTEXT.md`. The allocation reading is in `docs/adr/0001`.

- **Seed shape (noticed):** every logical assignment is 15 rows: 14 identical at `h` and the latest id at `2h`. Plain `SUM` gives whole hours/day (0.5 → 8h). We chose the plain sum over dedupe or latest-row (see ADR 0001).
- **Other seed facts:** 46,665 rows end on a weekend. Eli Nakamura (id 5) has 0h capacity but still has assignments. Names include RTL scripts (ids 496–497). The data runs 2025-06-02 → 2027-01-03.
- **Working days are Mon–Fri only;** holidays are ignored (no calendar data). Counting weekends would put Ana at 56/40 instead of 40/40 in the week of 2025-12-29.
- **Weeks are ISO (Monday start).** The API expands `from`/`to` to whole weeks and echoes the weeks it used. Anything over 26 weeks is a 400, a scale guard for production (thousands of people, 2 years).
- **Capacity is one current value per person** with no history, so an edit rewrites past weeks too. Accepted and noted. 0 capacity with any allocation counts as over-allocated; the cell shows hours, never a %.
- **GET shape:** `{from, to, weeks[], people[{id, name, capacity, allocated[]}]}`, with `allocated` dense and aligned to `weeks`. Capacity sits on the person, so an edit is a one-field change on the client.
- **PATCH:** body `{capacity}`, 0–168 in steps of 0.5. Returns 400/404, or 200 with `{id, name, capacity}`. Last write wins; no etag (deferred).
- **Save flow:** optimistic across every cached range: cancel range fetches, snapshot, apply, roll back on error. On success, write the server value everywhere and invalidate any range whose fetch was in flight (it could carry the old capacity). No full refetch.
- **Failed save:** the row reverts and shows an inline error with Retry/Dismiss that stays until acted on (aria-live). The same person can't be edited while their save is in flight.
- **To see a failed save:** run `docker compose stop api`, then edit. We decided against a fault-injection flag.
- **UI:** the week ‹ Today › controls shift the window by one week, alongside From/To inputs. The range lives in the URL, and the default is the current week + 7. The previous grid stays dimmed while a new range loads. Rows are sorted with `Intl.Collator`, the name column and header are sticky, names get `dir="auto"`, and there's an "Only over-allocated" toggle.
- **Deferred:** row virtualization, server pagination/team filter, search, capacity history, and concurrency control.
- **Expected values to check in the running grid:** Ana 40/40 (week of 2025-12-29), Dee 45/40 (week of 2026-01-05, over), Eli 20/0 (week of 2026-01-05, over).
- Broke the spec into tickets 01–07 under `.scratch/capacity-view/issues/`.
- **Tests:** the brief asks for "a test or two around the parts you'd be nervous to change". Ticket 07 covers two tests on the optimistic save: rollback across ranges, and a late range response after a save. It is ready-for-agent.

## 2026-09-26: ticket 01, read-only grid

- **Working-day overlap without a day series:** a week's Mon–Fri is `week_start .. week_start + 4`, so the overlap is `LEAST(end, fri) - GREATEST(start, mon) + 1`. The join already guarantees it's ≥ 1. 26 weeks × 500 people returns in ~130 ms.
- **Numerics come back as float8.** Capacity is in 0.5 steps and allocations are whole hours, so there's no rounding risk at this scale.
- **Errors are `{"error": "..."}`** and the client shows the message as-is.
- **Client expands to whole weeks before building the query key**, so mid-week dates that map to the same weeks share one cache entry.
- **Over is marked by a ▲ glyph, bold text and a left rule as well as colour.** Full gets a blue tint and outline, under is plain. Each cell also carries visually hidden status text for screen readers.
- **Open question: 0 / 0 shows as "fully allocated"** (the rule says equal means full). Eli's row is blue in every empty week. It isn't alarming, but it is noisy. The alternative is a neutral style for 0/0.
- **Verified:** curl and headless Chrome, with the range temporarily pinned to 2025-12-31..2026-01-07 in `App.tsx` and then reverted. Ana 40/40 full (week of 2025-12-29); Dee 45/40 over and Eli 20/0 over (week of 2026-01-05). All 500 people render, collator-sorted, with the RTL names last. The 400s read clearly: missing, malformed, inverted, and 27 weeks.
- **Loading and error states are placeholders** ("Loading…" and a `role="alert"` line). Ticket 03 replaces them.

## 2026-09-26: ticket 02, range navigation

- **URL holds the expanded range; no params means the default window.** "Today" clears the params instead of writing today's dates, so a bare link always opens on the viewer's current week. Arrows and Today use `pushState`, so Back/Forward step through them. From/To edits use `replaceState`, because a date input fires on every typed segment and each would otherwise become a Back step. A URL with only one of the two params is an error, not half-default.
- **From/To are a local draft; only a valid draft is committed to the URL.** An invalid draft (To before From, over 26 weeks) shows inline and keeps the last valid grid on screen. A hand-edited invalid URL shows the same error and renders no grid, so nothing is requested.
- **Inputs keep the typed mid-week date** rather than snapping to Monday: rewriting a date input's value while someone types into it breaks the typing. The whole-week range is visible in the line under the title and in the column headers (from the server echo).
- **Aborting abandoned ranges comes from TanStack Query v5**: `fetchCapacity` consumes the signal, so a query that loses its last observer is cancelled. Verified by hand: the abandoned request fails with `net::ERR_ABORTED` and never renders.
- **Left as is:** the line under the title shows the client's expansion, not the server echo, so mid-load it runs ahead of the dimmed columns. A hand-edited invalid URL renders no grid, so fixing it starts from "Loading…".
- **Not tested in code:** the spec defers range tests (ticket 07 owns the only two). Verified by hand: default, ‹ › Today, mid-week expansion, both inline errors with no request, reload, Back, the dimmed "Updating…" state, and the abort.

## 2026-09-26: ticket 03, load, empty and error states

- **TanStack drops `placeholderData` once a fetch errors**, so `keepPreviousData` alone can't keep the stale view. The grid remembers the last range that loaded and keeps a second, disabled `useQuery` on that key. It observes the cache entry rather than copying the data, so ticket 04's cache writes still reach a stale grid, and the entry isn't garbage-collected.
- **Stale banner names both ranges:** the one that failed and the one on screen, with the time it loaded. Covers a failed navigation and a failed refetch of the same range alike. The stale grid also gets a dashed border and is desaturated.
- **Default query retries kept (3, with backoff):** an outage takes about 7 s to surface as an error or stale banner, and Retry takes as long to fail again. A blip never flashes an error, and that's worth the wait.
- **The skeleton draws the real week headers** (computed client-side from the requested range) and 12 placeholder rows, so the layout doesn't jump when data lands.
- **Verified** in headless Chrome over CDP: the skeleton while the response was held; `docker compose stop api` then ›, which gave the stale banner; reload with the API down, which gave the error banner; `start api` then Retry, which recovered from both. The empty state was checked by rewriting the response to `people: []` in the browser, since the seed can't produce it.
- **Not tested in code,** as in 01/02: ticket 07 owns the only tests.
- **For ticket 04:** the stale fallback is watched only by a disabled observer. `invalidateQueries` (active-only by default) won't refetch it, so the save flow must write every `['capacity', …]` entry directly. `setQueryData` also resets `dataUpdatedAt`, so after an optimistic edit the stale banner's "loaded at" shows the edit time.

## 2026-09-26: ticket 04, edit capacity

- **Snapshots and rollback are per person, not per range.** The cache keeps the edited person's previous capacity for each range and restores only that person, so if one save fails it can't undo another person's save that succeeded in the meantime. Rollback is already wired in; the error UI (Retry/Dismiss) is ticket 05. Until then a failed save just snaps back with no message.
- **Stale range responses:** the save records the range fetches it cancels, and when it settles it also cancels any fetch still in flight. It writes the server value into every cached range, then refetches those ranges. A range that finishes loading during the save gets overwritten by the server value when the save settles, so it doesn't need a refetch.
- **`keepPreviousData` is a snapshot,** so an edit made while a new range loads didn't show in the dimmed grid. While loading, the grid now reads the previous range from the fallback observer (ticket 03), which watches the live cache entry.
- **Client validation accepts a comma decimal** ("37,5"), since managers may type in a comma-decimal locale. The server only takes JSON numbers.
- **Blur with an invalid value keeps the editor open** with its hint, instead of silently discarding the value. Esc is the way out.
- **Saving disables the button with `aria-disabled`, not `disabled`,** so keyboard focus stays on it after Enter.
- **Verified** in headless Chrome over CDP, with the PATCH held for 2 s: Dee 40 → 45 turns the week of 2026-01-05 from over to full, with "Saving…" on the row. Dee's editor won't open during the save, and Ana's still does. The result holds across ‹ (an uncached range), › and reload. 37.2, 200 and abc each show a hint and send nothing, and an unchanged value sends nothing. A range fetch held across a save and then released ends on the new value. curl covered the 400/404 paths. Dee and Ana were reset to 40 afterwards.
- **Not tested in code,** as before: ticket 07 owns the tests.

## 2026-09-26: ticket 05, failed save

- **The failure lives in the mutation cache, not in row state.** Save mutations use `gcTime: Infinity`, and the row reads its latest save with `useMutationState`. A failure outlives the row unmounting (e.g. the ticket 06 filter hiding it), and nothing clears it on a timer. The next save, Retry or Dismiss removes the settled saves for that person, so at most one is kept per person.
- **Reason wording:** a 4xx shows the server's `error` as-is. A thrown `fetch` is "network error"; any 5xx is "server unavailable". With the API stopped, the Vite proxy answers 5xx, so that is the text you'll actually see.
- **The error is a full-width row under the person,** with its message sticky at the scroller's start edge so it stays readable however far the weeks are scrolled. It says the attempted value, the person, the reason and the capacity now shown. It uses `role="alert"`, like the load error.
- **Retry and Dismiss move focus to that person's capacity button,** because both remove the error row and focus would otherwise fall back to the page.
- **To see it in the browser:** open `/?from=2026-01-05&to=2026-01-11`, run `docker compose stop api`, change Dee Okafor to 45 and press Enter. The row snaps back to 40 (still ▲ 45 / 40, over) with the error below. Run `docker compose start api`, press Retry: Dee becomes 45 h and the week turns fully allocated. Reset Dee to 40 afterwards.
- **Verified** in headless Chrome over CDP: the steps above; a second failure on Ana while Dee's error stood, then dismissing Ana's without touching Dee's; Dee's error surviving a navigation to the next week and Back; a faked 400 showing the server message. Dee and Ana were reset to 40.
- **Fixed a gap from 04:** a range that loaded during a failed save had no snapshot, so it kept the attempted value until its refetch landed, and kept it for good if the refetch failed (as it does with the API down). Capacity is one figure per person, so that range now gets the snapshot from any other range. Verified with a PATCH rejected after 2.5 s while › loaded the next week: 45 while saving, then 40 and "network error".
- **Not tested in code,** as before: ticket 07 owns the tests.

## 2026-09-26: ticket 06, "Only over-allocated" toggle

- **The toggle is local state in the grid, not in the URL.** The spec only puts the range in the URL, and `useUrlRange` rewrites the whole query string. The toggle survives range changes, because the grid stays mounted. It resets on reload and when a hand-edited invalid URL unmounts the grid.
- **The filter is derived from the cached data at render time,** so it re-applies with no extra wiring when the range changes or an edit changes someone's status.
- **A person with a pending or failed save stays visible under the filter** until the save succeeds, is retried, or is dismissed. Otherwise "Saving…" would vanish with an edited row, and a failed save that rolled someone back to "not over" would hide their Retry/Dismiss row. The code review caught the second case. This means the count can include a person who isn't over.
- **The rows use `useDeferredValue`, so the switch flips at once.** Turning the filter off can mount all 500 rows. The "N of M people" count follows the rows, not the switch, so it never flashes "500 of 500".
- **A live "N of M people" count sits next to the switch (`role="status"`).** When an edit hides a row, the count is the only thing that says so.
- **Left unfinished:** when a successful save hides the edited row, focus falls back to `<body>`. The count announces the change, but a keyboard user loses their place.
- **Nobody over:** the message names the range and offers "Show everyone", which turns the filter off and moves focus to the switch. The week of 2027-02-01 shows it, since the seed data ends on 2027-01-03.
- **Verified** in headless Chrome over CDP: week of 2026-01-05 showed 500 people, then 15 of 500 with every row carrying an over cell. ‹ gave 39 of 500, › gave 15 again. Raising Dee to 45 gave 14 of 500 with Dee hidden (reset to 40 via curl). The week of 2027-02-01 showed the message, and "Show everyone" gave 500 with focus on the switch. Checked in light and dark mode. After the review fix: with the PATCH held, Dee stayed visible with "Saving…" (15 of 500) and was hidden once it was released (14 of 500). With the API stopped, Bo 40 → 30 failed; turning the filter on kept Bo and the error visible (16 of 500), and Dismiss hid Bo.
- **Not tested in code,** as before: ticket 07 owns the tests.

## 2026-09-26: ticket 07, tests around the capacity save

- **Both tests render the whole `App`** under a fresh `QueryClient` (default options, as in `main.tsx`) with `fetch` stubbed by a small in-memory server. It builds each response when the request arrives, so a held response carries the data as it was then. That is how the "late range response" test gets a stale 40.
- **The fake server ignores `AbortSignal` on purpose.** That is the worst case, a response already on the wire, so the test relies on the app discarding it and not on the fetch being aborted.
- **In test 1, the refetch on the way back to the first range is held,** so the assertion sees the rolled-back cache entry and not a fresh server read.
- **Checked the tests catch regressions:** skipping the rollback in `onSettled` fails test 1; turning both `cancelQueries` calls into no-ops fails test 2. Both were restored.
- **jsdom quirk:** its accessible-name computation drops the space before a visually-hidden span, so the Retry button reads "Retrysaving Dee Okafor". The selector allows an optional space instead of changing the markup, which reads correctly in browsers.
- **No `@testing-library/user-event`** is installed, so the tests use `fireEvent`. There is no Vitest setup file either, so jest-dom is imported in the test and `cleanup` is called by hand (Vitest globals are off).
- **Left unfinished, as the ticket says:** Dismiss, zero capacity, validation, range expansion and the backend seam.
