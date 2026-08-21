package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"jamaoxarid/backend/internal/config"
	"jamaoxarid/backend/internal/db"
	"jamaoxarid/backend/internal/store"
)

func main() {
	username := flag.String("username", envOr("ADMIN_USERNAME", "admin"), "admin login")
	password := flag.String("password", envOr("ADMIN_PASSWORD", "Admin123!"), "admin parol")
	phone := flag.String("phone", envOr("ADMIN_PHONE", "+998901111111"), "admin telefon")
	flag.Parse()

	cfg := config.Load()
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	st := store.New(pool)
	created, err := st.SeedAdmin(ctx, *username, *password, *phone)
	if err != nil {
		log.Fatalf("seed-admin: %v", err)
	}
	if !created {
		fmt.Println("Admin allaqachon mavjud — yangi foydalanuvchi yaratilmadi, parol o‘zgartirilmadi.")
		os.Exit(0)
	}
	fmt.Printf("Admin yaratildi.\n  login: %s\n  parol: %s\n", strings.TrimSpace(*username), *password)
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
