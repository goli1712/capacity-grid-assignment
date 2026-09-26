# Allocated hours are the plain sum of every assignment row

Each logical assignment in the seed (same person, project, start and end) is stored as 15 rows: 14 identical rows at `h` and one, always the highest id, at `2h`. We read `hours_per_day` literally and sum every row, so the 15 rows add up to `16h`. That always comes out to whole hours per day (0.125→2h, 0.25→4h, 0.375→6h, 0.5→8h), and it keeps allocated hours independent of a person's capacity. Only working days (Mon–Fri) are counted.

## Considered Options

- **Deduplicate, then sum**: gives 1.5h/day where the sum gives 8h. It treats the copies as a data bug and discards data we were told is fixed input.
- **Latest row as a fraction of the person's day** (`latest × capacity / 5`): for 40h people it matches the sum, but it makes allocated hours depend on capacity. A capacity edit would then change allocated hours, and a 0h person could never be over-allocated.

## Consequences

The query must not use `DISTINCT` or "latest row wins". If the data turns out to be an append-only edit history instead, this ADR and the capacity query change together.
