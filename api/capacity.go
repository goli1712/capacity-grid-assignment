package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"
)

const (
	dateLayout = "2006-01-02"
	maxWeeks   = 26
)

type capacityResponse struct {
	From   string           `json:"from"`
	To     string           `json:"to"`
	Weeks  []string         `json:"weeks"`
	People []personCapacity `json:"people"`
}

type personCapacity struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Capacity float64 `json:"capacity"`
	// Aligned with Weeks; dense, 0 where empty.
	Allocated []float64 `json:"allocated"`
}

// $1 is a Monday, $2 a Sunday. Every assignment row counts, duplicates included,
// times the working days it overlaps in the week: week_start + 4 is Friday.
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
// It should return, for every person and every week in the requested range,
// how many hours they are allocated and how much capacity they have.
//
// The response shape is yours to design — the grid in web/ is the consumer.
//
// TODO: implement.
//
// The range is expanded to whole ISO weeks: from back to its Monday, to
// forward to its Sunday. The response echoes the expanded range.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if n := int(to.Sub(from).Hours()/24+1) / 7; n > maxWeeks {
		writeError(w, http.StatusBadRequest, fmt.Sprintf(
			"range covers %d weeks; the maximum is %d", n, maxWeeks))
		return
	}

	people, err := s.loadCapacity(r.Context(), from, to)
	if err != nil {
		log.Printf("capacity %s..%s: %v", from.Format(dateLayout), to.Format(dateLayout), err)
		writeError(w, http.StatusInternalServerError, "could not load capacity")
		return
	}

	writeJSON(w, http.StatusOK, capacityResponse{
		From:   from.Format(dateLayout),
		To:     to.Format(dateLayout),
		Weeks:  weekStarts(from, to),
		People: people,
	})
}

func (s *server) loadCapacity(ctx context.Context, from, to time.Time) ([]personCapacity, error) {
	rows, err := s.db.Query(ctx, capacityQuery, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	people := []personCapacity{}
	for rows.Next() {
		var p personCapacity
		if err := rows.Scan(&p.ID, &p.Name, &p.Capacity, &p.Allocated); err != nil {
			return nil, err
		}
		people = append(people, p)
	}
	return people, rows.Err()
}

func parseRange(rawFrom, rawTo string) (time.Time, time.Time, error) {
	from, err := parseDate("from", rawFrom)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	to, err := parseDate("to", rawTo)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if to.Before(from) {
		return time.Time{}, time.Time{}, fmt.Errorf("to (%s) is before from (%s)", rawTo, rawFrom)
	}
	return from.AddDate(0, 0, -daysSinceMonday(from)), to.AddDate(0, 0, 6-daysSinceMonday(to)), nil
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

func weekStarts(from, to time.Time) []string {
	var weeks []string
	for d := from; !d.After(to); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d.Format(dateLayout))
	}
	return weeks
}
