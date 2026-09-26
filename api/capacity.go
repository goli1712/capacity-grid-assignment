package main

import (
	"fmt"
	"net/http"
	"time"
)

const (
	dateLayout = "2006-01-02"
	// maxWeeks caps a single request. Production rosters run to thousands of
	// people and two years of history, so an unbounded range is a real cost.
	maxWeeks = 26
)

type capacityResponse struct {
	From   string           `json:"from"`  // Monday of the first week
	To     string           `json:"to"`    // Sunday of the last week
	Weeks  []string         `json:"weeks"` // Mondays, ascending
	People []personCapacity `json:"people"`
}

type personCapacity struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Capacity float64 `json:"capacity"`
	// Allocated[i] is the allocated hours in Weeks[i]; dense, 0 where empty.
	Allocated []float64 `json:"allocated"`
}

// capacityQuery returns every person with one allocated-hours figure per week,
// ordered by week, for the whole weeks $1 (a Monday) to $2 (a Sunday).
//
// Allocated hours are the plain sum of every assignment row (ADR 0001) times
// the working days (Mon–Fri) the assignment overlaps in that week. Weeks come
// from a generated series so weeks with nothing in them still come back as 0.
const capacityQuery = `
WITH weeks AS (
	SELECT gs::date AS week_start
	FROM generate_series($1::date, $2::date, interval '1 week') AS gs
),
allocated AS (
	SELECT a.person_id,
	       w.week_start,
	       SUM(a.hours_per_day * (
	           LEAST(a.end_date, w.week_start + 4) - GREATEST(a.start_date, w.week_start) + 1
	       )) AS hours
	FROM assignments a
	JOIN weeks w
	  ON a.start_date <= w.week_start + 4
	 AND a.end_date >= w.week_start
	WHERE a.start_date <= $2::date
	  AND a.end_date >= $1::date
	GROUP BY a.person_id, w.week_start
)
SELECT p.id,
       p.name,
       p.weekly_hours::float8,
       array_agg(COALESCE(al.hours, 0)::float8 ORDER BY w.week_start)
FROM people p
CROSS JOIN weeks w
LEFT JOIN allocated al
  ON al.person_id = p.id
 AND al.week_start = w.week_start
GROUP BY p.id
ORDER BY p.id
`

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// The range is expanded to whole ISO weeks: from back to its Monday, to
// forward to its Sunday. The response echoes the expanded range.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	weeks := weekStarts(from, to)
	if len(weeks) > maxWeeks {
		writeError(w, http.StatusBadRequest, fmt.Sprintf(
			"range covers %d weeks; the maximum is %d", len(weeks), maxWeeks))
		return
	}

	rows, err := s.db.Query(r.Context(), capacityQuery, from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}
	defer rows.Close()

	people := []personCapacity{}
	for rows.Next() {
		var p personCapacity
		if err := rows.Scan(&p.ID, &p.Name, &p.Capacity, &p.Allocated); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load capacity")
			return
		}
		people = append(people, p)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}

	writeJSON(w, http.StatusOK, capacityResponse{
		From:   from.Format(dateLayout),
		To:     to.Format(dateLayout),
		Weeks:  weeks,
		People: people,
	})
}

// parseRange validates from/to and expands them to whole ISO weeks.
func parseRange(rawFrom, rawTo string) (from, to time.Time, err error) {
	from, err = parseDate("from", rawFrom)
	if err != nil {
		return
	}
	to, err = parseDate("to", rawTo)
	if err != nil {
		return
	}
	if to.Before(from) {
		err = fmt.Errorf("to (%s) is before from (%s)", rawTo, rawFrom)
		return
	}
	from = from.AddDate(0, 0, -daysSinceMonday(from))
	to = to.AddDate(0, 0, 6-daysSinceMonday(to))
	return
}

func parseDate(name, raw string) (time.Time, error) {
	if raw == "" {
		return time.Time{}, fmt.Errorf("%s is required (YYYY-MM-DD)", name)
	}
	d, err := time.Parse(dateLayout, raw)
	if err != nil {
		return time.Time{}, fmt.Errorf("%s must be a date in YYYY-MM-DD form, got %q", name, raw)
	}
	return d, nil
}

func daysSinceMonday(d time.Time) int {
	return (int(d.Weekday()) + 6) % 7
}

// weekStarts lists the Mondays from from (a Monday) up to to (a Sunday).
func weekStarts(from, to time.Time) []string {
	var weeks []string
	for d := from; !d.After(to); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d.Format(dateLayout))
	}
	return weeks
}
