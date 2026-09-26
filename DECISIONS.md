# Decisions

Yours to write, not your AI's. Short is good — bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- How to read hours_per_day? Each assignment is stored as 15 rows: 14 the same and the last one double. Since it's stated that the data is fixed input, removing duplicates would assume the copies are a bug. Also this was the only valid reading where there was over-allocation

- What counts as a working day? Mon-Fri

- How to handle grid after save? I decided optimistic update, because to the end user it gives the sensation of a faster application.

## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- What happens when there is 0 capacity but allocation associated? I decided to count as over in the beginning
but now that I'm looking at it I would probably mark it with another color/label


## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

It was the reason I created ticket 08 to fix a bunch of problems I found. Take a look at it if needed!
- The page had a full scroll which did not make any sense
- The table was not taking full width and was always showing horizontal scroll
- Added an input to the capacity cells to indicate they were editable
- Added tooltips for cells to make it easier to read the data

## What would you do differently with a week?

- Row virtualization and tanstack table integration with server pagination
- Holiday Calendar integrating with the current user calendar so that it adapts to anywhere a user lives
- Handle concurrency when updating the capacity
- Tests - More coverage