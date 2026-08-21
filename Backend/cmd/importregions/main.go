package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"jamaoxarid/backend/internal/config"
	"jamaoxarid/backend/internal/db"
)

type oid struct {
	Value string `json:"$oid"`
}

type node struct {
	ID     oid    `json:"_id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Parent *oid   `json:"parent"`
	Code   string `json:"code"`
	Status string `json:"status"`
}

func main() {
	file := flag.String("file", "scripts/ttsa.regions.json", "TTSA regions JSON yo‘li")
	flag.Parse()

	cfg := config.Load()
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}

	path := *file
	if !filepath.IsAbs(path) {
		if _, err := os.Stat(path); err != nil {
			alt := filepath.Join("backend", path)
			if _, err2 := os.Stat(alt); err2 == nil {
				path = alt
			}
		}
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("json o‘qilmadi (%s): %v", path, err)
	}

	var nodes []node
	if err := json.Unmarshal(raw, &nodes); err != nil {
		log.Fatal(err)
	}

	var regions, districts, mfys []node
	for _, n := range nodes {
		if n.Status != "" && n.Status != "active" {
			continue
		}
		switch n.Type {
		case "region":
			regions = append(regions, n)
		case "district":
			districts = append(districts, n)
		case "mfy":
			mfys = append(mfys, n)
		}
	}

	log.Printf("import: %d viloyat, %d tuman, %d MFY", len(regions), len(districts), len(mfys))

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback(ctx)

	oidToRegion := map[string]string{}
	for _, n := range regions {
		var id string
		err := tx.QueryRow(ctx, `
			INSERT INTO regions (source_oid, name, code)
			VALUES ($1,$2,$3)
			ON CONFLICT (source_oid) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code
			RETURNING id`, n.ID.Value, n.Name, n.Code).Scan(&id)
		if err != nil {
			log.Fatal("region:", err)
		}
		oidToRegion[n.ID.Value] = id
	}

	oidToCity := map[string]string{}
	for _, n := range districts {
		parent := ""
		if n.Parent != nil {
			parent = oidToRegion[n.Parent.Value]
		}
		var regionID any
		if parent != "" {
			regionID = parent
		}
		var id string
		err := tx.QueryRow(ctx, `
			INSERT INTO cities (source_oid, region_id, name)
			VALUES ($1,$2,$3)
			ON CONFLICT (source_oid) DO UPDATE SET name=EXCLUDED.name, region_id=COALESCE(EXCLUDED.region_id, cities.region_id)
			RETURNING id`, n.ID.Value, regionID, n.Name).Scan(&id)
		if err != nil {
			log.Fatal("district:", n.Name, err)
		}
		oidToCity[n.ID.Value] = id
	}

	insertedMFY := 0
	skippedMFY := 0
	for _, n := range mfys {
		if n.Parent == nil {
			skippedMFY++
			continue
		}
		cityID, ok := oidToCity[n.Parent.Value]
		if !ok {
			skippedMFY++
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO mfys (source_oid, city_id, name)
			VALUES ($1,$2,$3)
			ON CONFLICT (source_oid) DO UPDATE SET name=EXCLUDED.name, city_id=EXCLUDED.city_id`,
			n.ID.Value, cityID, n.Name)
		if err != nil {
			log.Fatal("mfy:", n.Name, err)
		}
		insertedMFY++
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Tayyor. Viloyat: %d, tuman: %d, MFY: %d (o‘tkazib yuborilgan: %d)\n",
		len(regions), len(districts), insertedMFY, skippedMFY)
}
