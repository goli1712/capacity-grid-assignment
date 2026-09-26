# 04: Edit capacity (happy path)

**What to build:** A manager clicks a person's capacity on their row, types a new value, and presses Enter (or clicks away). The row's cells immediately re-colour against the new capacity, with a "Saving…" indicator until the server confirms. The new capacity is correct in every week, including ranges the manager navigates to afterwards, and a range that was loading during the save can't bring the old value back. There's no page reload and no full refetch.

**Blocked by:** 01 (Read-only capacity grid), 02 (Range navigation)

**Status:** done

- [x] The capacity update endpoint accepts `{ capacity }` from 0 to 168 in steps of 0.5, and returns 200 with `{ id, name, capacity }` from a single update-returning statement.
- [x] 400 with a readable message for a malformed id, body or value; 404 for an unknown person. Last write wins.
- [x] Inline editor on the person's row: Enter or blur saves, Esc cancels. An unchanged value closes the editor without a request.
- [x] Client validation mirrors the server. An invalid value shows an inline hint and sends nothing.
- [x] Optimistic save: cancel in-flight range fetches, snapshot every cached range, and write the new capacity into all of them.
- [x] On success, write the server's returned capacity into every cached range, and invalidate any range whose fetch was in flight during the save.
- [x] While the save is in flight, the row shows "Saving…" and that person's editor is disabled; other people stay editable.
- [x] Verified in the browser: edit Dee Okafor's capacity to 45 and see the week of 2026-01-05 change from over to fully allocated; navigate to other weeks and back, and the new value holds; reload, and it persists.
