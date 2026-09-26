package db

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

type Database struct {
	Conn *sql.DB
}

func Connect(connStr string) (*Database, error) {
	conn, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := conn.PingContext(ctx); err != nil {
		log.Warn().Err(err).Msg("!! Database ping failed")
	} else {
		log.Info().Msg("Connected to PostgreSQL")
	}

	return &Database{Conn: conn}, nil
}

func (d *Database) Ping(ctx context.Context) error {
	if d == nil || d.Conn == nil {
		return sql.ErrConnDone
	}
	return d.Conn.PingContext(ctx)
}

func (d *Database) Close() error {
	if d != nil && d.Conn != nil {
		return d.Conn.Close()
	}
	return nil
}
