# Birga Arzon Backend

Modular monolith (Go + PostgreSQL).

## Commands

```bash
go run ./cmd/reset-db
go run ./cmd/migrate
go run ./cmd/migrate -status
go run ./cmd/import-regions
go run ./cmd/import-yangi
go run ./cmd/create-admin
go run ./cmd/api
```

Swagger: http://127.0.0.1:8080/swagger/index.html

### Database Reset (`reset-db`)
`.env` dagi ma'lumotlar bazasini butunlay o'chirib (DROP DATABASE), qaytadan yaratadi (CREATE DATABASE) va avtomatik ravishda barcha migratsiyalarni (migrate up) qo'llaydi:
- `go run ./cmd/reset-db` (xavfsizlik uchun tasdiqlash so'raydi: `ha` / `yo'q`)
- `go run ./cmd/reset-db -yes` yoki `go run ./cmd/reset-db -force` (so'rovsiz darhol bajarish)
- `go run ./cmd/reset-db -migrate=false` (migratsiyasiz faqat bo'sh baza yaratish)
- `go run ./cmd/reset-db -maint-db=postgres` (agar PostgreSQL ma'muriy bazasi boshqa bo'lsa)

### Catalog Import (`import-yangi`)
Imports categories, subcategories, products and group buys from `scripts/yangi.sql`:
- `go run ./cmd/import-yangi` (defaults to all)
- `go run ./cmd/import-yangi -cats=true -subcats=true -products=true -yigims=false` (custom flags)
- `go run ./cmd/import-yangi -f path/to/dump.sql` (custom file path)

## Safety

- Default migrate only applies UP migrations
- Dirty DB aborts unless `--force`
- Down requires `--force` (data-loss risk)
