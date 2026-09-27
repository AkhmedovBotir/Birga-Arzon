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
	"birgaarzon/backend/internal/database"
	"birgaarzon/backend/modules/admin"
)

func main() {
	firstName := flag.String("ism", "", "Ism")
	lastName := flag.String("familiya", "", "Familiya")
	phone := flag.String("telefon", "", "Telefon raqam")
	username := flag.String("username", "", "Username")
	password := flag.String("password", "", "Password (tekshiruv yo'q)")
	flag.Parse()

	console.PrintMigrateBanner("CREATE GENERAL")

	cfg, err := config.Load()
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := database.Connect(ctx, cfg)
	if err != nil {
		console.Error(fmt.Sprintf("database: %v", err))
		os.Exit(1)
	}
	defer pool.Close()

	svc := admin.NewService(admin.NewRepository(pool), cfg)

	reader := bufio.NewReader(os.Stdin)
	ism := prompt(reader, "Ism", *firstName)
	familiya := prompt(reader, "Familiya", *lastName)
	telefon := prompt(reader, "Telefon", *phone)
	user := prompt(reader, "Username", *username)
	pass := prompt(reader, "Password", *password)

	created, err := svc.CreateGeneral(ctx, ism, familiya, telefon, user, pass)
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}

	console.Success("General admin yaratildi")
	console.Info(fmt.Sprintf("ID: %s", created.ID))
	console.Info(fmt.Sprintf("Username: %s · Role: %s", created.Username, created.Role))
	console.Info(fmt.Sprintf("%s %s · %s", created.FirstName, created.LastName, created.Phone))
}

func prompt(r *bufio.Reader, label, existing string) string {
	if strings.TrimSpace(existing) != "" {
		return strings.TrimSpace(existing)
	}
	fmt.Printf("  %s: ", label)
	line, _ := r.ReadString('\n')
	return strings.TrimSpace(line)
}
