package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/lib/pq"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/internal/config"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})

	if len(os.Args) < 2 {
		fmt.Println("Usage: go run ./cmd/migrate [up|down|status]")
		os.Exit(1)
	}

	cmd := strings.ToLower(os.Args[1])
	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to PostgreSQL")
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal().Err(err).Msg("Postgres is unreachable")
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create schema_migrations table")
	}

	migrationsDir := findMigrationsDir()
	if migrationsDir == "" {
		log.Fatal().Msg("Could not find migrations directory")
	}

	switch cmd {
	case "up":
		runUp(db, migrationsDir)
	case "down":
		runDown(db, migrationsDir)
	case "status":
		runStatus(db, migrationsDir)
	default:
		log.Fatal().Msgf("Unknown command: %s (expected 'up', 'down', 'status')", cmd)
	}
}

func findMigrationsDir() string {
	candidates := []string{"migrations", "../migrations", "../../migrations"}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	return ""
}

func runUp(db *sql.DB, dir string) {
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to read migration files")
	}
	sort.Strings(files)

	for _, file := range files {
		base := filepath.Base(file)
		version := strings.TrimSuffix(base, ".up.sql")

		var exists bool
		_ = db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if exists {
			continue
		}

		content, err := os.ReadFile(file)
		if err != nil {
			log.Fatal().Err(err).Str("file", file).Msg("Failed to read migration file")
		}

		tx, err := db.Begin()
		if err != nil {
			log.Fatal().Err(err).Msg("Transaction begin failed")
		}

		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			log.Fatal().Err(err).Str("version", version).Msg("Migration failed")
		}

		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
			tx.Rollback()
			log.Fatal().Err(err).Str("version", version).Msg("Failed to record migration")
		}

		if err := tx.Commit(); err != nil {
			log.Fatal().Err(err).Msg("Transaction commit failed")
		}

		log.Info().Str("version", version).Msg("Migration applied successfully")
	}
}

func runDown(db *sql.DB, dir string) {
	var lastVersion string
	err := db.QueryRow("SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1").Scan(&lastVersion)
	if err == sql.ErrNoRows {
		log.Info().Msg("No migrations to rollback")
		return
	} else if err != nil {
		log.Fatal().Err(err).Msg("Failed to query migrations")
	}

	downFile := filepath.Join(dir, lastVersion+".down.sql")
	content, err := os.ReadFile(downFile)
	if err != nil {
		log.Fatal().Err(err).Str("file", downFile).Msg("Down migration file not found")
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal().Err(err).Msg("Transaction begin failed")
	}

	if _, err := tx.Exec(string(content)); err != nil {
		tx.Rollback()
		log.Fatal().Err(err).Str("version", lastVersion).Msg("Rollback failed")
	}

	if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = $1", lastVersion); err != nil {
		tx.Rollback()
		log.Fatal().Err(err).Str("version", lastVersion).Msg("Failed to delete migration record")
	}

	if err := tx.Commit(); err != nil {
		log.Fatal().Err(err).Msg("Transaction commit failed")
	}

	log.Info().Str("version", lastVersion).Msg("Rollback applied successfully")
}

func runStatus(db *sql.DB, dir string) {
	rows, err := db.Query("SELECT version, applied_at FROM schema_migrations ORDER BY applied_at ASC")
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to query schema_migrations")
	}
	defer rows.Close()

	fmt.Println("\n--- Applied Migrations ---")
	count := 0
	for rows.Next() {
		var ver, appliedAt string
		_ = rows.Scan(&ver, &appliedAt)
		fmt.Printf(" [X] %s (applied: %s)\n", ver, appliedAt)
		count++
	}
	if count == 0 {
		fmt.Println(" (None)")
	}
	fmt.Println()
}
