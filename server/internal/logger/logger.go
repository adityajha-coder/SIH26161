package logger

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type ctxKey string

const requestIDKey ctxKey = "request_id"

func Init(level, format string) {
	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		lvl = zerolog.DebugLevel
	}
	zerolog.SetGlobalLevel(lvl)

	if format == "console" || format == "pretty" {
		log.Logger = log.Output(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		})
	} else {
		log.Logger = zerolog.New(os.Stdout).With().Timestamp().Caller().Logger()
	}
}

func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = time.Now().Format("20060102150405.000000")
		}

		ctx := context.WithValue(r.Context(), requestIDKey, reqID)
		r = r.WithContext(ctx)

		next.ServeHTTP(rw, r)

		log.Info().
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", rw.statusCode).
			Dur("duration_ms", time.Since(start)).
			Str("request_id", reqID).
			Msg("HTTP request handled")
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
