package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

const maxCapacity = 168

type updatePersonRequest struct {
	Capacity *float64 `json:"capacity"`
}

type personResponse struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Capacity float64 `json:"capacity"`
}

const updateCapacityQuery = `
UPDATE people
SET weekly_hours = $2
WHERE id = $1
RETURNING id, name, weekly_hours::float8
`

// handleUpdatePerson serves PATCH /api/people/{id}
//
// It should update the person's weekly hours. What it returns is yours to
// design — the grid is the consumer, and it has state to keep honest.
//
// TODO: implement.
//
// The body is {"capacity": hours}. It returns the person as stored, so the
// client can reconcile its optimistic value. Last write wins.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	// people.id is an int4, so a larger id is malformed rather than unknown.
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil || id < 1 {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("id must be a positive integer, got %q", r.PathValue("id")))
		return
	}

	capacity, err := decodeCapacity(http.MaxBytesReader(w, r.Body, 1<<10))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var p personResponse
	err = s.db.QueryRow(r.Context(), updateCapacityQuery, id, capacity).Scan(&p.ID, &p.Name, &p.Capacity)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, fmt.Sprintf("no person with id %d", id))
		return
	}
	if err != nil {
		log.Printf("update person %d: %v", id, err)
		writeError(w, http.StatusInternalServerError, "could not update capacity")
		return
	}

	writeJSON(w, http.StatusOK, p)
}

func decodeCapacity(body io.Reader) (float64, error) {
	var req updatePersonRequest
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return 0, fmt.Errorf(`body must be JSON like {"capacity": 37.5}: %v`, err)
	}
	if dec.More() {
		return 0, errors.New("body must be a single JSON object")
	}
	if req.Capacity == nil {
		return 0, errors.New("capacity is required")
	}

	c := *req.Capacity
	switch {
	case c < 0:
		return 0, fmt.Errorf("capacity can't be negative, got %v", c)
	case c > maxCapacity:
		return 0, fmt.Errorf("capacity can't exceed %d hours a week, got %v", maxCapacity, c)
	case c*2 != math.Trunc(c*2):
		return 0, fmt.Errorf("capacity must be in steps of 0.5 hours, got %v", c)
	}
	return c, nil
}
