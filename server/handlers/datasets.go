package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/storage"
)

type DatasetHandler struct {
	db      *sql.DB
	storage *storage.Client
}

func NewDatasetHandler(db *sql.DB, store *storage.Client) *DatasetHandler {
	return &DatasetHandler{
		db:      db,
		storage: store,
	}
}

type DatasetResponse struct {
	ID            string          `json:"id"`
	CaseID        string          `json:"case_id"`
	Name          string          `json:"name"`
	Category      string          `json:"category"`
	Format        string          `json:"format"`
	StorageURI    string          `json:"storage_uri"`
	FileSizeBytes int64           `json:"file_size_bytes"`
	ChecksumSHA256 string         `json:"checksum_sha256"`
	DownloadURL   string          `json:"download_url,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

func (h *DatasetHandler) ListDatasets(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT id, case_id, name, category, format, storage_uri, file_size_bytes, checksum_sha256, created_at, updated_at
		FROM datasets
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, `{"error": "Failed to query datasets"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var datasets []DatasetResponse
	for rows.Next() {
		var d DatasetResponse
		if err := rows.Scan(&d.ID, &d.CaseID, &d.Name, &d.Category, &d.Format, &d.StorageURI, &d.FileSizeBytes, &d.ChecksumSHA256, &d.CreatedAt, &d.UpdatedAt); err != nil {
			continue
		}
		datasets = append(datasets, d)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(datasets)
}

func (h *DatasetHandler) GetDataset(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var d DatasetResponse

	err := h.db.QueryRow(`
		SELECT id, case_id, name, category, format, storage_uri, file_size_bytes, checksum_sha256, created_at, updated_at
		FROM datasets
		WHERE id = $1
	`, id).Scan(&d.ID, &d.CaseID, &d.Name, &d.Category, &d.Format, &d.StorageURI, &d.FileSizeBytes, &d.ChecksumSHA256, &d.CreatedAt, &d.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error": "Dataset not found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
		return
	}

	objectKey := extractObjectKey(d.StorageURI)
	if objectKey != "" {
		signedURL, err := h.storage.GetPresignedURL(r.Context(), objectKey, 1*time.Hour)
		if err == nil {
			d.DownloadURL = signedURL
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(d)
}

func (h *DatasetHandler) DownloadDataset(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var storageURI, name string

	err := h.db.QueryRow(`SELECT storage_uri, name FROM datasets WHERE id = $1`, id).Scan(&storageURI, &name)
	if err == sql.ErrNoRows {
		http.Error(w, "Dataset not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	objectKey := extractObjectKey(storageURI)
	reader, size, contentType, err := h.storage.GetObject(r.Context(), objectKey)
	if err != nil {
		log.Error().Err(err).Str("key", objectKey).Msg("Failed to open object from storage")
		http.Error(w, "File not available in storage", http.StatusNotFound)
		return
	}
	defer reader.Close()

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`.tif"`)
	if size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}

	_, _ = io.Copy(w, reader)
}

func (h *DatasetHandler) LocalDownload(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "Missing key parameter", http.StatusBadRequest)
		return
	}

	reader, size, contentType, err := h.storage.GetObject(r.Context(), key)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", contentType)
	if size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}
	_, _ = io.Copy(w, reader)
}

func extractObjectKey(uri string) string {
	if strings.HasPrefix(uri, "s3://") {
		parts := strings.SplitN(strings.TrimPrefix(uri, "s3://"), "/", 2)
		if len(parts) == 2 {
			return parts[1]
		}
	}
	if strings.HasPrefix(uri, "file://") {
		return strings.TrimPrefix(uri, "file://")
	}
	return uri
}
