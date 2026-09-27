package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/console"
	"birgaarzon/backend/internal/migrate"

	"github.com/jackc/pgx/v5"
)

func main() {
	force := flag.Bool("force", false, "tasdiqlash so'rovisiz darhol o'chirish va qayta yaratish")
	yes := flag.Bool("yes", false, "tasdiqlash so'rovisiz darhol o'chirish va qayta yaratish (-force bilan bir xil)")
	runMigrate := flag.Bool("migrate", true, "baza yaratilgach barcha migratsiyalarni avtomatik qo'llash")
	maintDB := flag.String("maint-db", "postgres", "PostgreSQL serveriga ulanish uchun ma'muriy (maintenance) baza")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		console.Error(fmt.Sprintf("Konfiguratsiya yuklanmadi: %v", err))
		os.Exit(1)
	}

	console.PrintResetBanner(cfg.DBName)

	skipPrompt := *force || *yes
	if !skipPrompt {
		fmt.Printf("  Host:     %s:%s\n", cfg.DBHost, cfg.DBPort)
		fmt.Printf("  Foydalanuvchi: %s\n", cfg.DBUser)
		fmt.Printf("  Baza nomi:     %s\n\n", cfg.DBName)
		console.Warn(fmt.Sprintf("DIQQAT: '%s' bazasidagi BARCHA jadvallar va ma'lumotlar butunlay O'CHIRIB tashlanadi!", cfg.DBName))
		fmt.Print("\n  Haqiqatan ham davom ettirasizmi? (ha / yo'q): ")

		reader := bufio.NewReader(os.Stdin)
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(strings.ToLower(input))

		if input != "ha" && input != "yes" && input != "y" && input != "ha!" {
			console.Info("Amal bekor qilindi. Ma'lumotlar bazasi o'zgarishsiz qoldi.")
			os.Exit(0)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	maintURL := cfg.MaintenanceDatabaseURL(*maintDB)
	conn, err := pgx.Connect(ctx, maintURL)
	if err != nil {
		console.Error(fmt.Sprintf("PostgreSQL serveriga ('%s' bazasi orqali) ulanib bo'lmadi: %v", *maintDB, err))
		console.Info("PostgreSQL servisi ishlab turganini va .env dagi login/parol to'g'riligini tekshiring.")
		os.Exit(1)
	}

	console.Info(fmt.Sprintf("'%s' bazasidagi faol ulanishlar uzilmoqda...", cfg.DBName))
	_, err = conn.Exec(ctx, `
		SELECT pg_terminate_backend(pid)
		FROM pg_stat_activity
		WHERE datname = $1 AND pid <> pg_backend_pid();
	`, cfg.DBName)
	if err != nil {
		console.Warn(fmt.Sprintf("Faol ulanishlarni uzishda ogohlantirish (e'tiborsiz qoldirilishi mumkin): %v", err))
	}

	console.Info(fmt.Sprintf("'%s' bazasi o'chirilmoqda (DROP DATABASE)...", cfg.DBName))
	dropSQL := fmt.Sprintf("DROP DATABASE IF EXISTS %s;", quoteIdent(cfg.DBName))
	if _, err := conn.Exec(ctx, dropSQL); err != nil {
		_ = conn.Close(ctx)
		console.Error(fmt.Sprintf("Baza o'chirilmadi: %v", err))
		os.Exit(1)
	}
	console.Success(fmt.Sprintf("Eski '%s' bazasi o'chirildi.", cfg.DBName))

	console.Info(fmt.Sprintf("Yangi '%s' bazasi yaratilmoqda (CREATE DATABASE)...", cfg.DBName))
	createSQL := fmt.Sprintf("CREATE DATABASE %s WITH ENCODING 'UTF8';", quoteIdent(cfg.DBName))
	if _, err := conn.Exec(ctx, createSQL); err != nil {
		_ = conn.Close(ctx)
		console.Error(fmt.Sprintf("Yangi baza yaratilmadi: %v", err))
		os.Exit(1)
	}
	console.Success(fmt.Sprintf("Yangi '%s' bazasi yaratildi.", cfg.DBName))

	_ = conn.Close(ctx)

	if *runMigrate {
		console.Info("Bazada migratsiyalar ishga tushirilmoqda (migrate up)...")
		runner := migrate.New(cfg)
		if err := runner.Up(); err != nil {
			console.Error(fmt.Sprintf("Migratsiyalarni qo'llashda xatolik yuz berdi: %v", err))
			os.Exit(1)
		}
	} else {
		console.Info("Migratsiyalar o'tkazib yuborildi (-migrate=false).")
	}

	fmt.Println()
	console.Success("Ma'lumotlar bazasi muvaffaqiyatli qayta tiklandi!")
	fmt.Println()
	fmt.Println("  Keyingi tavsiya etiladigan buyruqlar:")
	fmt.Println("    1. Regionlarni yuklash:      go run ./cmd/import-regions")
	fmt.Println("    2. Yangi katalog importi:    go run ./cmd/import-yangi")
	fmt.Println("    3. General admin yaratish:   go run ./cmd/create-admin")
	fmt.Println("    4. Serverni ishga tushirish: go run ./cmd/api")
	fmt.Println()
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
