package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"jamaoxarid/backend/internal/config"
	"jamaoxarid/backend/internal/db"
	"jamaoxarid/backend/internal/handler"
	"jamaoxarid/backend/internal/i18n"
	"jamaoxarid/backend/internal/service"
	"jamaoxarid/backend/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
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

	app := &service.App{
		Cfg:   cfg,
		Store: st,
	}
	h := &handler.Handler{App: app}

	go func() {
		t := time.NewTicker(15 * time.Second)
		defer t.Stop()
		for range t.C {
			app.ProcessDeadlines(context.Background())
		}
	}()

	_ = os.MkdirAll("uploads", 0o755)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "Accept-Language"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(i18n.Middleware)

	r.Get("/health", h.Health)
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(abs("uploads")))))
	r.Get("/pay/mock/{id}", h.MockPayPage)
	r.Post("/pay/mock/{id}/confirm", h.MockPayConfirm)

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/sms/request", h.RequestSMS)
		r.Post("/auth/sms/verify", h.VerifySMS)
		r.Post("/auth/telegram", h.Telegram)
		r.Post("/auth/login", h.Login)
		r.Post("/auth/check-phone", h.CheckPhone)
		r.Get("/cities", h.Cities)
		r.Get("/cities/{id}/mfys", h.Mfys)
		r.Get("/regions", h.Regions)
		r.Get("/regions/{regionId}/cities", h.Cities)

		r.Group(func(r chi.Router) {
			r.Use(h.Auth)
			r.Get("/auth/me", h.Me)
			r.Patch("/auth/me", h.PatchMe)
			r.Get("/notifications", h.Notifications)
			r.Get("/group-buys", h.GroupBuys)
			r.Get("/group-buys/{id}", h.GroupBuy)
			r.Get("/categories", h.Categories)
			r.Get("/subcategories", h.Subcategories)
			r.Get("/products", h.Products)

			r.Group(func(r chi.Router) {
				r.Use(h.Role("customer"))
				r.Get("/cart", h.Cart)
				r.Put("/cart/items", h.PutCart)
				r.Post("/orders", h.Checkout)
				r.Get("/orders", h.Orders)
				r.Get("/orders/{id}", h.Order)
				r.Post("/orders/{id}/cancel", h.CancelOrder)
				r.Post("/orders/{id}/pay", h.Pay)
				r.Post("/orders/{id}/cod", h.COD)
				r.Get("/orders/{id}/pickup-code", h.PickupCode)
			})

			r.Route("/admin", func(r chi.Router) {
				r.Use(h.Role("admin"))
				r.Get("/stats", h.AdminStats)
				r.Get("/users", h.AdminUsers)
				r.Get("/couriers", h.AdminCouriers)
				r.Post("/couriers", h.AdminCreateCourier)
				r.Patch("/couriers/{id}", h.AdminUpdateCourier)
				r.Delete("/couriers/{id}", h.AdminDeleteCourier)
				r.Get("/orders", h.AdminOrders)
				r.Post("/orders/issue", h.Issue)
				r.Post("/regions", h.AdminCreateRegion)
				r.Patch("/regions/{id}", h.AdminUpdateRegion)
				r.Delete("/regions/{id}", h.AdminDeleteRegion)
				r.Post("/cities", h.AdminCreateCity)
				r.Patch("/cities/{id}", h.AdminUpdateCity)
				r.Delete("/cities/{id}", h.AdminDeleteCity)
				r.Post("/mfys", h.AdminCreateMfy)
				r.Patch("/mfys/{id}", h.AdminUpdateMfy)
				r.Delete("/mfys/{id}", h.AdminDeleteMfy)
				r.Post("/group-buys", h.CreateGroupBuy)
				r.Patch("/group-buys/{id}", h.UpdateGroupBuy)
				r.Delete("/group-buys/{id}", h.DeleteGroupBuy)
				r.Post("/group-buys/{id}/close", h.CloseGroupBuy)
				r.Post("/group-buys/{id}/ready", h.ReadyGroupBuy)
				r.Post("/group-buys/{id}/cancel", h.CancelGroupBuy)
				r.Get("/categories", h.Categories)
				r.Post("/categories", h.CreateCategory)
				r.Patch("/categories/{id}", h.UpdateCategory)
				r.Delete("/categories/{id}", h.DeleteCategory)
				r.Get("/subcategories", h.Subcategories)
				r.Post("/subcategories", h.CreateSubcategory)
				r.Patch("/subcategories/{id}", h.UpdateSubcategory)
				r.Delete("/subcategories/{id}", h.DeleteSubcategory)
				r.Get("/products", h.Products)
				r.Post("/products", h.CreateProduct)
				r.Patch("/products/{id}", h.UpdateProduct)
				r.Delete("/products/{id}", h.DeleteProduct)
			})

			r.Route("/courier", func(r chi.Router) {
				r.Use(h.Role("courier", "admin"))
				r.Get("/deliveries", h.CourierDeliveries)
				r.Post("/group-buys/{id}/accept", h.CourierAccept)
				r.Post("/orders/issue", h.Issue)
			})
		})
	})

	log.Printf("Jamoa xarid API %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, r); err != nil {
		log.Fatal(err)
	}
}

func abs(p string) string {
	a, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return a
}
