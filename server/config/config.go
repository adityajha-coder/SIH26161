package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	CorsOrigin      string
	DatabaseURL     string
	RedisURL        string
	S3Endpoint      string
	S3AccessKey     string
	S3SecretKey     string
	S3Bucket        string
	S3Region        string
	S3UseSSL        bool
	LocalStorageDir string
	LogLevel        string
	LogFormat       string
}

func Load() *Config {
	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	endpoint := getFirstEnv("S3_ENDPOINT", "MINIO_ENDPOINT", "http://localhost:9000")
	useSSLStr := getFirstEnv("S3_USE_SSL", "MINIO_USE_SSL", "")
	useSSL := false
	if useSSLStr != "" {
		useSSL = (useSSLStr == "true" || useSSLStr == "1")
	} else if strings.HasPrefix(endpoint, "https://") || strings.Contains(endpoint, "amazonaws.com") || strings.Contains(endpoint, "supabase.co") || strings.Contains(endpoint, "r2.cloudflarestorage.com") {
		useSSL = true
	}

	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		if useSSL {
			endpoint = "https://" + endpoint
		} else {
			endpoint = "http://" + endpoint
		}
	}

	return &Config{
		Port:            getEnv("API_PORT", "8080"),
		CorsOrigin:      getEnv("API_CORS_ORIGIN", "*"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://sih26161:password@localhost:5432/sih26161?sslmode=disable"),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379"),
		S3Endpoint:      endpoint,
		S3AccessKey:     getFirstEnv("S3_ACCESS_KEY", "MINIO_ACCESS_KEY", "minioadmin"),
		S3SecretKey:     getFirstEnv("S3_SECRET_KEY", "MINIO_SECRET_KEY", "minioadmin"),
		S3Bucket:        getFirstEnv("S3_BUCKET", "MINIO_BUCKET", "sih26161"),
		S3Region:        getEnv("S3_REGION", "auto"),
		S3UseSSL:        useSSL,
		LocalStorageDir: getEnv("LOCAL_STORAGE_DIR", "data/storage"),
		LogLevel:        getEnv("LOG_LEVEL", "debug"),
		LogFormat:       getEnv("LOG_FORMAT", "console"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getFirstEnv(primaryKey, fallbackKey, defaultVal string) string {
	if val := os.Getenv(primaryKey); val != "" {
		return val
	}
	if val := os.Getenv(fallbackKey); val != "" {
		return val
	}
	return defaultVal
}
