package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/console"
	"birgaarzon/backend/internal/database"
	"birgaarzon/backend/internal/server"

	_ "birgaarzon/backend/docs"
)

// @title           Birga Arzon API
// @version         1.0
// @description     Modular monolith backend for Admin, Kuryer and User apps.
// @BasePath        /
// @schemes         http
func main() {
	cfg, err := config.Load()
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.Connect(ctx, cfg)
	if err != nil {
		console.Error(fmt.Sprintf("database: %v", err))
		os.Exit(1)
	}
	defer pool.Close()

	srv := server.New(cfg, pool)
	httpServer := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           srv.Engine(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	console.PrintBanner(console.StartupInfo{
		AppName:   cfg.AppName,
		Env:       cfg.AppEnv,
		Addr:      cfg.Addr(),
		DBHost:    cfg.DBHost,
		DBName:    cfg.DBName,
		Modules:   srv.ModuleNames(),
		Swagger:   fmt.Sprintf("http://127.0.0.1:%s/swagger/index.html", cfg.HTTPPort),
		StartedAt: time.Now(),
	})

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			console.Error(err.Error())
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	console.Info("Shutting down gracefully…")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = httpServer.Shutdown(shutdownCtx)
	console.Success("Bye")
}
