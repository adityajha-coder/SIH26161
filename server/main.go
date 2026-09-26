package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/config"
	"github.com/sih26161/backend/db"
	"github.com/sih26161/backend/handlers"
	"github.com/sih26161/backend/logger"
	"github.com/sih26161/backend/storage"
	"github.com/sih26161/backend/ws"
)

func main() {
	cfg := config.Load()
	logger.Init(cfg.LogLevel, cfg.LogFormat)

	log.Info().
		Str("port", cfg.Port).
		Msg("Starting backend API...")

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Warn().Err(err).Msg("Database not connected on startup")
	} else {
		defer database.Close()
	}

	store, err := storage.NewClient(cfg)
	if err != nil {
		log.Warn().Err(err).Msg("Storage client initialization warning")
	}

	hub := ws.NewHub()
	go hub.Run()

	healthH := handlers.NewHealthHandler(database)
	var sqlDB *sql.DB
	if database != nil {
		sqlDB = database.Conn
	}
	datasetH := handlers.NewDatasetHandler(sqlDB, store)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(logger.RequestLogger)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", cfg.CorsOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		AllowCredentials: true,
	}))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", healthH.Health)
		r.Get("/health/db", healthH.HealthDB)
		r.Get("/ws", hub.HandleWebSocket)
		r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"service":"sih26161-backend","version":"1.0.0"}`))
		})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/datasets", datasetH.ListDatasets)
		r.Get("/datasets/{id}", datasetH.GetDataset)
		r.Get("/datasets/{id}/download", datasetH.DownloadDataset)
		r.Get("/storage/download", datasetH.LocalDownload)
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Msgf("Server listening on http://localhost:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server listen failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(ctx)
	log.Info().Msg("Server stopped.")
}
