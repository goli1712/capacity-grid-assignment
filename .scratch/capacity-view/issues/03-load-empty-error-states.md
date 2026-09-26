# 03: Load, empty and error states

**What to build:** On first load, the manager sees a skeleton grid rather than a blank page. If the grid fails to load, they see a clear error with Retry. If a refresh fails after data was already shown, the last good data stays on screen, labelled as stale. A range with nobody in it shows an explicit empty message rather than an empty table.

**Blocked by:** 01 (Read-only capacity grid)

**Status:** done

- [x] First load shows a skeleton that roughly matches the grid's layout.
- [x] A failed load with no previous data shows an error banner with Retry, and Retry refetches.
- [x] A failed load with previous data keeps that data visible, labelled stale, with Retry.
- [x] An empty result shows a "no people" message.
- [x] Verified in the browser by stopping the API container, loading or navigating, then starting it again and pressing Retry.
