package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/rs/zerolog/log"

	"github.com/sih26161/backend/config"
)

type Client struct {
	s3            *s3.Client
	presignClient *s3.PresignClient
	bucket        string
	localDir      string
	isLocal       bool
}

func findProjectRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if fi, err := os.Stat(filepath.Join(dir, "data", "raw")); err == nil && fi.IsDir() {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "."
}

func resolveLocalStorageDir(relDir string) string {
	root := findProjectRoot()
	target := filepath.Join(root, relDir)
	_ = os.MkdirAll(target, 0755)
	abs, _ := filepath.Abs(target)
	return abs
}

func NewClient(cfg *config.Config) (*Client, error) {
	c := &Client{
		bucket:   cfg.S3Bucket,
		localDir: resolveLocalStorageDir(cfg.LocalStorageDir),
	}

	if cfg.S3Endpoint == "" || cfg.S3AccessKey == "" {
		log.Warn().Msg("S3 credentials not configured; using local filesystem storage")
		c.isLocal = true
		return c, nil
	}

	s3Client := s3.New(s3.Options{
		BaseEndpoint: aws.String(cfg.S3Endpoint),
		Region:       cfg.S3Region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, ""),
		UsePathStyle: true,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	_, err := s3Client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(c.bucket),
	})
	if err != nil {
		log.Warn().Err(err).Msgf("S3 endpoint %s / bucket %s check failed; falling back to local filesystem storage", cfg.S3Endpoint, c.bucket)
		c.isLocal = true
		return c, nil
	}

	c.s3 = s3Client
	c.presignClient = s3.NewPresignClient(s3Client)
	log.Info().Str("endpoint", cfg.S3Endpoint).Str("bucket", c.bucket).Msg("Connected to S3 object storage")
	return c, nil
}

func (c *Client) UploadFile(ctx context.Context, objectKey, localFilePath, contentType string) (string, error) {
	objectKey = strings.TrimPrefix(objectKey, "/")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if c.isLocal {
		destPath := filepath.Join(c.localDir, objectKey)
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return "", err
		}
		in, err := os.Open(localFilePath)
		if err != nil {
			return "", err
		}
		defer in.Close()

		out, err := os.Create(destPath)
		if err != nil {
			return "", err
		}
		defer out.Close()

		if _, err := io.Copy(out, in); err != nil {
			return "", err
		}
		return fmt.Sprintf("s3://%s/%s", c.bucket, objectKey), nil
	}

	f, err := os.Open(localFilePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return "", err
	}

	_, err = c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(objectKey),
		Body:          f,
		ContentLength: aws.Int64(fi.Size()),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("S3 upload failed: %w", err)
	}

	log.Info().Str("bucket", c.bucket).Str("key", objectKey).Int64("size", fi.Size()).Msg("File uploaded to S3")
	return fmt.Sprintf("s3://%s/%s", c.bucket, objectKey), nil
}

func (c *Client) DownloadFile(ctx context.Context, objectKey, localDestPath string) error {
	objectKey = strings.TrimPrefix(objectKey, "/")
	objectKey = strings.TrimPrefix(objectKey, "data/storage/")
	if err := os.MkdirAll(filepath.Dir(localDestPath), 0755); err != nil {
		return err
	}

	if c.isLocal {
		srcPath := filepath.Join(c.localDir, objectKey)
		in, err := os.Open(srcPath)
		if err != nil {
			return err
		}
		defer in.Close()

		out, err := os.Create(localDestPath)
		if err != nil {
			return err
		}
		defer out.Close()

		_, err = io.Copy(out, in)
		return err
	}

	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return err
	}
	defer out.Body.Close()

	dest, err := os.Create(localDestPath)
	if err != nil {
		return err
	}
	defer dest.Close()

	_, err = io.Copy(dest, out.Body)
	return err
}

func (c *Client) GetPresignedURL(ctx context.Context, objectKey string, expiry time.Duration) (string, error) {
	objectKey = strings.TrimPrefix(objectKey, "/")
	objectKey = strings.TrimPrefix(objectKey, "data/storage/")

	if c.isLocal {
		return fmt.Sprintf("/api/v1/storage/download?key=%s", url.QueryEscape(objectKey)), nil
	}

	presignedReq, err := c.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(objectKey),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignedReq.URL, nil
}

func (c *Client) GetObject(ctx context.Context, objectKey string) (io.ReadCloser, int64, string, error) {
	objectKey = strings.TrimPrefix(objectKey, "/")
	objectKey = strings.TrimPrefix(objectKey, "data/storage/")

	if c.isLocal {
		srcPath := filepath.Join(c.localDir, objectKey)
		fi, err := os.Stat(srcPath)
		if err != nil {
			return nil, 0, "", err
		}
		f, err := os.Open(srcPath)
		if err != nil {
			return nil, 0, "", err
		}
		return f, fi.Size(), "image/tiff", nil
	}

	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return nil, 0, "", err
	}

	var size int64
	if out.ContentLength != nil {
		size = *out.ContentLength
	}
	contentType := "application/octet-stream"
	if out.ContentType != nil {
		contentType = *out.ContentType
	}

	return out.Body, size, contentType, nil
}

func (c *Client) IsLocal() bool {
	return c.isLocal
}

func (c *Client) Bucket() string {
	return c.bucket
}
