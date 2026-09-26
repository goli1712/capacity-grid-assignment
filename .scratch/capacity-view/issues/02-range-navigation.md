# 02: Range navigation

**What to build:** A manager moves the whole window back or forward one week at a time, jumps back to the current week with "Today", or picks From/To dates. Mid-week dates expand to whole weeks. The chosen range lives in the URL, so it survives a reload and can be shared. While a new range loads, the previous grid stays visible but dimmed, with an "Updating…" indicator, and a slow response for an abandoned range never replaces the one the manager moved to.

**Blocked by:** 01 (Read-only capacity grid)

**Status:** done

- [x] With no range in the URL, the default is the current ISO week plus the seven after it.
- [x] ‹ and › shift the whole window by one week; "Today" resets to the default window.
- [x] From/To inputs expand to whole ISO weeks, and the displayed columns match what the server echoed.
- [x] `to` before `from`, or more than 26 weeks, shows an inline error and sends no request.
- [x] Reloading or sharing the URL reproduces the same range.
- [x] While a new range loads, the previous grid stays visible and dimmed, with an "Updating…" indicator. There's no layout jump.
- [x] Requests for ranges the manager has moved away from are aborted, and their responses never render.
