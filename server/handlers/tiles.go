package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/storage"
)

type TileHandler struct {
	storage     *storage.Client
	projectRoot string
}

func NewTileHandler(store *storage.Client) *TileHandler {
	return &TileHandler{
		storage:     store,
		projectRoot: findRoot(),
	}
}

func (h *TileHandler) ServeTerrainTile(w http.ResponseWriter, r *http.Request) {
	z := chi.URLParam(r, "z")
	x := chi.URLParam(r, "x")
	y := chi.URLParam(r, "y")
	y = strings.TrimSuffix(y, ".png")

	h.serveTile(w, r, "terrain", z, x, y)
}

func (h *TileHandler) ServeHillshadeTile(w http.ResponseWriter, r *http.Request) {
	z := chi.URLParam(r, "z")
	x := chi.URLParam(r, "x")
	y := chi.URLParam(r, "y")
	y = strings.TrimSuffix(y, ".png")

	h.serveTile(w, r, "hillshade", z, x, y)
}

func (h *TileHandler) ServeContours(w http.ResponseWriter, r *http.Request) {
	localPath := filepath.Join(h.projectRoot, "data", "processed", "tiles", "contours.geojson")
	if fi, err := os.Stat(localPath); err == nil && !fi.IsDir() {
		w.Header().Set("Content-Type", "application/geo+json")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, localPath)
		return
	}

	// Fallback to object storage
	if h.storage == nil {
		http.Error(w, "Contours GeoJSON not found", http.StatusNotFound)
		return
	}
	ctx := r.Context()
	objectKey := "tiles/contours.geojson"
	reader, size, contentType, err := h.storage.GetObject(ctx, objectKey)
	if err != nil {
		http.Error(w, "Contours GeoJSON not found", http.StatusNotFound)
		return
	}
	defer reader.Close()

	if contentType == "" {
		contentType = "application/geo+json"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}
	_, _ = io.Copy(w, reader)
}

func (h *TileHandler) ServeTileManifest(w http.ResponseWriter, r *http.Request) {
	localPath := filepath.Join(h.projectRoot, "data", "processed", "tiles", "tile_manifest.json")
	if fi, err := os.Stat(localPath); err == nil && !fi.IsDir() {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, localPath)
		return
	}

	if h.storage == nil {
		http.Error(w, "Tile manifest not found", http.StatusNotFound)
		return
	}
	ctx := r.Context()
	reader, _, _, err := h.storage.GetObject(ctx, "tiles/tile_manifest.json")
	if err != nil {
		http.Error(w, "Tile manifest not found", http.StatusNotFound)
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", "application/json")
	_, _ = io.Copy(w, reader)
}

func (h *TileHandler) serveTile(w http.ResponseWriter, r *http.Request, tileType, z, x, y string) {
	relPath := filepath.Join("data", "processed", "tiles", tileType, z, x, fmt.Sprintf("%s.png", y))
	localPath := filepath.Join(h.projectRoot, relPath)

	if fi, err := os.Stat(localPath); err == nil && !fi.IsDir() {
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, localPath)
		return
	}

	// Try object storage
	if h.storage == nil {
		http.Error(w, "Tile not found", http.StatusNotFound)
		return
	}
	ctx := r.Context()
	objectKey := fmt.Sprintf("tiles/%s/%s/%s/%s.png", tileType, z, x, y)
	reader, size, contentType, err := h.storage.GetObject(ctx, objectKey)
	if err != nil {
		// Return 404 if tile outside coverage bounds
		http.Error(w, "Tile not found", http.StatusNotFound)
		return
	}
	defer reader.Close()

	if contentType == "" {
		contentType = "image/png"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}
	_, _ = io.Copy(w, reader)
}

func findRoot() string {
	candidates := []string{".", "..", "../.."}
	for _, c := range candidates {
		target := filepath.Join(c, "data", "processed")
		if fi, err := os.Stat(target); err == nil && fi.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	dir, err := os.Getwd()
	if err != nil {
		log.Warn().Err(err).Msg("Could not detect working directory")
	}
	return dir
}
