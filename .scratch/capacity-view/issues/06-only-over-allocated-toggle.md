# 06: "Only over-allocated" toggle

**What to build:** A manager turns on "Only over-allocated" to hide everyone who has no over-allocated week in the visible range, so they can focus on the people who need attention. Turning it off shows everyone again.

**Blocked by:** 01 (Read-only capacity grid)

**Status:** done

- [x] With the toggle on, only people with at least one over-allocated week in the current range are shown.
- [x] The filter re-applies when the range changes, and after a capacity edit changes someone's status.
- [x] If nobody is over-allocated, a clear message says so rather than an empty table.
