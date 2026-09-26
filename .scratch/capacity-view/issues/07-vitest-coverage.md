# 07: Tests around the capacity save flow

**What to build:** Two tests around the part we'd be most nervous to change: the optimistic capacity save across cached ranges. The brief asks for "a test or two around the parts you'd be nervous to change" rather than a full suite, so this deliberately stops at two. Both go through the seam in `../spec.md` (Testing Decisions): the rendered app in jsdom with `fetch` stubbed, asserting only what the manager sees.

**Blocked by:** 04 (Edit capacity, happy path), 05 (Failed save)

**Status:** done

- [x] **A failed save rolls back everywhere.** Load one range, navigate to a second, then edit a person's capacity and have the capacity update fail. That person's row shows the previous capacity and statuses in the current range and, after navigating back, in the first range too. The inline error names the attempted value and the person. Retry then succeeds and the new capacity shows in both ranges.
- [x] **A late range response can't undo a save.** Start navigating to a new range and hold its response. Save a capacity edit that succeeds. Then release the held range response, which carries the old capacity. The grid ends up showing the new capacity, with the status that follows from it.
- [x] Tests use only the rendered UI and the stubbed network. No exports exist purely for testing.
- [x] `docker compose exec web npm test` passes. The Vitest config already uses jsdom.

Not covered here, and worth adding if they become risky: cell status edge cases (zero capacity), range expansion and validation, and a backend test running the real handlers against the seeded Postgres (Ana 40/40, Dee 45/40, Eli 20/0).
