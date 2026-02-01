package sqlite

import (
	"database/sql"
	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// NewEntClient creates a new ent client with custom SQLite driver configuration.
// This driver enables foreign key enforcement and WAL mode for better concurrency.
func NewEntClient(dbPath string) (*sql.DB, error) {
	// Open database with modernc.org/sqlite driver
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", dbPath))
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool for SQLite single-writer constraint
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0) // Connections live forever

	return db, nil
}

// OpenEntDriver opens an ent driver with the custom SQLite configuration.
func OpenEntDriver(dbPath string) (*entsql.Driver, error) {
	db, err := NewEntClient(dbPath)
	if err != nil {
		return nil, err
	}

	return entsql.OpenDB(dialect.SQLite, db), nil
}
