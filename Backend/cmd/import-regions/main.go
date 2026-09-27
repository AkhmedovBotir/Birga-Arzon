package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/console"
	"birgaarzon/backend/internal/database"
	"birgaarzon/backend/modules/region"

	"github.com/google/uuid"
)

type mongoOID struct {
	OID string `json:"$oid"`
}

type rawRegion struct {
	ID     mongoOID  `json:"_id"`
	Name   string    `json:"name"`
	Type   string    `json:"type"`
	Parent *mongoOID `json:"parent"`
	Code   string    `json:"code"`
	Status string    `json:"status"`
}

func main() {
	viloyat := flag.Bool("v", false, "Viloyatlarni import qilish (region)")
	tuman := flag.Bool("t", false, "Tumanlarni import qilish (district) — viloyat ichida")
	mfy := flag.Bool("m", false, "MFYlarni import qilish (mfy)")
	file := flag.String("f", "scripts/ttsa.regions.json", "JSON fayl yo‘li")
	flag.Parse()

	// Default: faqat viloyat + tuman (mfy yo‘q)
	if !*viloyat && !*tuman && !*mfy {
		*viloyat = true
		*tuman = true
	}

	console.PrintMigrateBanner("IMPORT REGIONS")
	console.Info(fmt.Sprintf("flags: -v=%v -t=%v -m=%v", *viloyat, *tuman, *mfy))
	console.Info(fmt.Sprintf("file: %s", *file))

	cfg, err := config.Load()
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	pool, err := database.Connect(ctx, cfg)
	if err != nil {
		console.Error(fmt.Sprintf("database: %v", err))
		os.Exit(1)
	}
	defer pool.Close()

	abs, err := filepath.Abs(*file)
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		console.Error(fmt.Sprintf("read file: %v", err))
		os.Exit(1)
	}

	var raw []rawRegion
	if err := json.Unmarshal(data, &raw); err != nil {
		console.Error(fmt.Sprintf("parse json: %v", err))
		os.Exit(1)
	}
	console.Info(fmt.Sprintf("JSON yozuvlari: %d", len(raw)))

	repo := region.NewRepository(pool)
	legacyToID := map[string]uuid.UUID{}

	// Preload existing IDs for parent linking
	rows, err := pool.Query(ctx, `SELECT id, legacy_id FROM regions`)
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}
	for rows.Next() {
		var id uuid.UUID
		var legacy string
		if err := rows.Scan(&id, &legacy); err != nil {
			rows.Close()
			console.Error(err.Error())
			os.Exit(1)
		}
		legacyToID[legacy] = id
	}
	rows.Close()

	importType := func(jsonType, label string) (int, error) {
		want, err := region.MapJSONType(jsonType)
		if err != nil {
			return 0, err
		}
		n := 0
		for _, item := range raw {
			if item.Type != jsonType {
				continue
			}
			status := item.Status
			if status == "" {
				status = "active"
			}
			rec := &region.Region{
				LegacyID: item.ID.OID,
				Name:     item.Name,
				Code:     item.Code,
				Type:     want,
				Status:   status,
			}
			if item.Parent != nil && item.Parent.OID != "" {
				pid, ok := legacyToID[item.Parent.OID]
				if !ok {
					// Parent not imported yet — skip with warn
					console.Warn(fmt.Sprintf("parent topilmadi (%s): %s → %s", label, item.Name, item.Parent.OID))
					continue
				}
				rec.ParentID = &pid
			} else if want != region.TypeViloyat {
				console.Warn(fmt.Sprintf("parent yo‘q (%s): %s", label, item.Name))
				continue
			}

			if err := repo.Upsert(ctx, rec); err != nil {
				return n, fmt.Errorf("%s %s: %w", label, item.Name, err)
			}
			legacyToID[item.ID.OID] = rec.ID
			n++
		}
		return n, nil
	}

	total := 0
	if *viloyat {
		n, err := importType("region", "viloyat")
		if err != nil {
			console.Error(err.Error())
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("Viloyatlar: %d", n))
		total += n
	}
	if *tuman {
		n, err := importType("district", "tuman")
		if err != nil {
			console.Error(err.Error())
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("Tumanlar: %d", n))
		total += n
	}
	if *mfy {
		n, err := importType("mfy", "mfy")
		if err != nil {
			console.Error(err.Error())
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("MFYlar: %d", n))
		total += n
	}

	stats, err := repo.Stats(ctx)
	if err != nil {
		console.Warn(err.Error())
	} else {
		console.Info(fmt.Sprintf("DB holat: viloyat=%d tuman=%d mfy=%d", stats.Viloyat, stats.Tuman, stats.MFY))
	}
	console.Success(fmt.Sprintf("Import tugadi · jami upsert: %d", total))
}
