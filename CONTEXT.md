# Capacity

How much work each person is committed to, week by week, measured against how much they
can do, so a manager can spot over-commitment before a week starts.

## Language

**Person**:
Someone on the team whose time is planned.
_Avoid_: Employee, member, resource

**Assignment**:
A commitment of a person to a project for a date span, expressed in hours per working day.
_Avoid_: Booking, allocation (the record is the assignment; allocation is the total)

**Working day**:
A Monday to Friday. Weekends never carry allocation, even when an assignment's span covers them. Public holidays are not modelled.
_Avoid_: Business day

**Week**:
An ISO week, running Monday to Sunday and identified by its Monday.
_Avoid_: Sprint, period

**Allocated hours**:
The total hours a person is committed to in a week: the sum of every assignment's hours for each working day in that week.
_Avoid_: Load, booked hours, utilisation

**Capacity**:
The hours a person can work in a week. It is one current figure per person and applies to every week, past and future.
_Avoid_: Availability, weekly hours (that is the stored field, not the concept)

**Over-allocated**:
A person in a week whose allocated hours are strictly greater than their capacity. Any allocation against zero capacity counts as over-allocated.
_Avoid_: Overbooked, over capacity

**Fully allocated**:
A person in a week whose allocated hours exactly equal their capacity.
_Avoid_: At capacity
