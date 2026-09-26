# 05: Failed save

**What to build:** When a capacity save fails, the manager sees that person's row revert to the last saved capacity, with its cell colours reverting too. An inline error on that row says what they tried to save, for whom, and why it failed. They can Retry (which resends the value they tried) or Dismiss. The error stays until they act on it and is announced to screen readers. Other rows are unaffected.

**Blocked by:** 04 (Edit capacity, happy path)

**Status:** done

- [x] On error, every cached range is restored from the snapshot, and the row shows its last saved capacity and statuses.
- [x] The inline error names the attempted value and the person, and gives the server's message for a 4xx or "network error / server unavailable" otherwise.
- [x] Retry resends the attempted value through the same optimistic flow; Dismiss clears the error.
- [x] The error never disappears on a timer and is announced through a live region.
- [x] Errors are held per person: a failure on one row doesn't affect editing or saving others.
- [x] Verified in the browser by stopping the API container, saving an edit, then starting it again and pressing Retry. The steps are documented in the worklog.
