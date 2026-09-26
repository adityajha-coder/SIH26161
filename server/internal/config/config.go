package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	CorsOrigin   string
	DatabaseURL  string
	RedisURL     string
	MinioEndpoint string
	MinioBucket  string
	LogLevel     string
	LogFormat    string
}

func Load() *Config {
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	return &Config{
		Port:          getEnv("API_PORT", "8080"),
		CorsOrigin:    getEnv("API_CORS_ORIGIN", "*"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://sih26161:password@localhost:5432/sih26161?sslmode=disable"),
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379"),
		MinioEndpoint: getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioBucket:   getEnv("MINIO_BUCKET", "sih26161"),
		LogLevel:      getEnv("LOG_LEVEL", "debug"),
		LogFormat:     getEnv("LOG_FORMAT", "console"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
