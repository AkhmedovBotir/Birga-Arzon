package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"sort"
	"strings"

	"jamaoxarid/backend/migrations"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 20
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

func checksum(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// Migrate applies SQL files that are new or whose content changed.
// Already-applied files with the same checksum are skipped.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			checksum TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("schema_migrations: %w", err)
	}

	entries, err := migrations.Files.ReadDir(".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	applied, skipped, updated := 0, 0, 0
	for _, name := range names {
		b, err := migrations.Files.ReadFile(name)
		if err != nil {
			return err
		}
		sum := checksum(b)

		var prev string
		err = pool.QueryRow(ctx, `SELECT checksum FROM schema_migrations WHERE name=$1`, name).Scan(&prev)
		if err == nil && prev == sum {
			skipped++
			continue
		}
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("migration %s lookup: %w", name, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(b)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO schema_migrations (name, checksum, applied_at)
			VALUES ($1,$2,now())
			ON CONFLICT (name) DO UPDATE SET checksum=EXCLUDED.checksum, applied_at=now()`,
			name, sum); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s record: %w", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		if prev != "" {
			updated++
			log.Printf("migration yangilandi: %s", name)
		} else {
			applied++
			log.Printf("migration qo‘llandi: %s", name)
		}
	}
	log.Printf("migratsiya: %d yangi, %d yangilangan, %d o‘tkazib yuborilgan", applied, updated, skipped)
	return nil
}
