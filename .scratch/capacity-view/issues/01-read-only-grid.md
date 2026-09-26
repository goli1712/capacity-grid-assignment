# 01: Read-only capacity grid for a fixed range

**What to build:** A manager opens the app and sees every person as a row and the current ISO week plus the seven after it as columns. Each cell shows allocated hours against capacity (e.g. "45 / 40"). Over-allocated weeks stand out, and not by colour alone. Fully allocated weeks look different from both under- and over-allocated ones. Each row shows how many visible weeks the person is over-allocated. This is the first end-to-end path: capacity read API, data fetching, and grid.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The capacity read endpoint takes `from`/`to`, expands them to whole ISO weeks (Monday to Sunday), and returns the shape in the spec: the expanded range, the list of weeks, and people each with capacity and a dense allocated-hours list aligned to the weeks.
- [x] 400 with a readable message for a missing or malformed date, `to` before `from`, or more than 26 weeks after expansion.
- [x] Allocated hours count working days (Mon–Fri) only and sum every assignment row, with no deduplication (ADR 0001).
- [x] One SQL query, scoped to assignments overlapping the range, with week buckets from a generated series so empty weeks come back as 0. No SQL assembled from strings.
- [x] Every person is returned, including those with no allocation in the range.
- [x] TanStack Query is added and the grid reads through it, keyed by the expanded range.
- [x] Cell status: over-allocated if allocated is greater than capacity (any allocation against zero capacity is over), fully allocated if equal, otherwise under. Shown in hours, never %.
- [x] Rows sorted with a locale-aware collator. Names render with automatic direction (the RTL names display correctly). The name column and week header are sticky.
- [x] Checked with curl and in the browser: Ana Ferreira 40/40 in the week of 2025-12-29, Dee Okafor 45/40 (over) and Eli Nakamura 20/0 (over) in the week of 2026-01-05. Record the result in the worklog.
