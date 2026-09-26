.PHONY: all infra-up infra-down infra-logs run test migrate migrate-down seed upload-dem

all: infra-up

infra-up:
	docker compose up -d

infra-down:
	docker compose down

infra-logs:
	docker compose logs -f

run:
	cd server && go run .

test:
	cd server && go test -v ./...

migrate:
	cd server && go run ./cmd/migrate up

migrate-down:
	cd server && go run ./cmd/migrate down

seed:
	cd server && go run ./cmd/seed

upload-dem:
	cd server && go run ./cmd/upload_dem
