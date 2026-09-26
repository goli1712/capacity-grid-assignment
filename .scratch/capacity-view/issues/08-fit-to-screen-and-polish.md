# 08: Grid fits the screen, and the page reads as one tool

**What to build:** A manager opens the app and the whole view — title, range toolbar and grid — fits the browser window with no page scrollbar. The grid uses all the width it has, scrolls vertically inside itself when there are more people than fit, and only scrolls horizontally when the weeks are wider than the screen. Capacity looks editable before anyone hovers it. Hovering or focusing a week cell spells out what the numbers mean for that person and week. Each week column carries a subtle "Week 1", "Week 2", … label so the manager can refer to a column by position. The title and range toolbar look like one header for the tool, not loose form controls.

**Blocked by:** 01 (Read-only grid), 02 (Range navigation), 04 (Edit capacity)

**Status:** resolved

- [x] No page-level scroll at any viewport height ≥ 480px: the page is a full-height column, and the grid's scroller takes the remaining height (flex, `min-height: 0`) instead of a hard-coded `100vh - 12rem`.
- [x] The grid's scroller spans the available width. Horizontal scroll appears only when the weeks don't fit, and the sticky name column and header still work.
- [x] Capacity is visibly editable at rest: a field-like affordance (no icon: the field already reads as an input), and a hint in the column header that it can be edited. Keyboard, Enter/Esc/blur and the Saving… and error states from 04/05 behave as before.
- [x] Each week cell has a tooltip on hover and on keyboard focus: person, week (Mon–Fri dates), allocated hours, capacity, and the difference ("5 h over", "10 h free", "Fully allocated"). Hours only, never %. Cells use a single roving tab stop moved with arrow keys, not one tab stop per cell. Screen-reader text stays as it is now.
- [x] Each week header shows a subtle ordinal label above the date — "Week 1" for the first visible week, "Week 2" for the next, and so on. It's the column's position in the visible range, so it renumbers when the range moves. It's quieter than the date, which stays the main label.
- [x] Header redesign: the title, the visible range as readable dates, ‹ Today › stepper and From/To inputs grouped as one toolbar. The legend and "Only over-allocated" sit in a secondary row above the grid.
- [x] The table gets a visual pass: row rhythm, hover row highlight, and the current week marked in its column header. Over, full and under stay distinguishable without colour, and in dark mode.
- [x] Keeps the system font and the existing status colours, so it stays consistent with 01–07.
- [x] The skeleton, empty, stale and error states from 03 still fit the same layout with no page scroll.
- [x] `docker compose exec web npm test` still passes.
- [x] Checked in the browser at 1440×900, 1024×768 and 390×844 (phone), light and dark: no page scroll; the first week column reads "Week 1"; the tooltip on Dee Okafor's week of 2026-01-05 reads 45 h of 40 h, 5 h over. Record in the worklog.
