FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /bin/server .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /bin/migrate ./cmd/migrate
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /bin/seed ./cmd/seed

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /bin/server /app/server
COPY --from=builder /bin/migrate /app/migrate
COPY --from=builder /bin/seed /app/seed
COPY migrations /app/migrations

EXPOSE 8080

USER nobody:nobody

ENTRYPOINT ["/app/server"]
