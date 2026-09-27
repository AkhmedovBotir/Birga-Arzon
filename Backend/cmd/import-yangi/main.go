package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/console"
	"birgaarzon/backend/internal/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type rawCategory struct {
	id        uuid.UUID
	name      string
	createdAt time.Time
}

type rawSubcategory struct {
	id         uuid.UUID
	categoryID uuid.UUID
	name       string
	createdAt  time.Time
}

type rawProduct struct {
	id            uuid.UUID
	subcategoryID uuid.UUID
	name          string
	description   string
	unitLabel     string
	priceUzs      int64
	photoURL      string
	stock         int
	active        bool
	createdAt     time.Time
	updatedAt     time.Time
}

type rawGroupBuy struct {
	id            uuid.UUID
	title         string
	description   string
	photoURL      string
	unitLabel     string
	priceUzs      int64
	minVolume     int
	currentVolume int
	status        string
	productID     *uuid.UUID
	photoURLs     []string
	kind          string
	createdAt     time.Time
	updatedAt     time.Time
}

type rawGroupBuyItem struct {
	groupBuyID uuid.UUID
	productID  uuid.UUID
	quantity   int
}

type deltaOp struct {
	Insert string `json:"insert"`
}

type deltaDoc struct {
	Ops []deltaOp `json:"ops"`
}

func main() {
	filePath := flag.String("f", "", "SQL fayl yo'li (standart: scripts/yangi.sql)")
	importCats := flag.Bool("cats", true, "Kategoriyalarni import qilish")
	importSubcats := flag.Bool("subcats", true, "Subkategoriyalarni import qilish")
	importProds := flag.Bool("products", true, "Mahsulotlarni import qilish")
	importYigims := flag.Bool("yigims", true, "Yig'imlarni (group_buys) import qilish")
	flag.Parse()

	console.PrintMigrateBanner("IMPORT YANGI CATALOG")

	resolvedFile := resolveFilePath(*filePath)
	console.Info(fmt.Sprintf("Fayl: %s", resolvedFile))
	console.Info(fmt.Sprintf("Rejim: cats=%v subcats=%v products=%v yigims=%v", *importCats, *importSubcats, *importProds, *importYigims))

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

	file, err := os.Open(resolvedFile)
	if err != nil {
		console.Error(fmt.Sprintf("faylni ochishda xato: %v", err))
		os.Exit(1)
	}
	defer file.Close()

	categories, subcategories, products, groupBuys, groupBuyItems, err := parseSQLDump(file)
	if err != nil {
		console.Error(fmt.Sprintf("SQL dumpni o'qishda xato: %v", err))
		os.Exit(1)
	}

	console.Info(fmt.Sprintf("Topilgan ma'lumotlar: %d ta kategoriya, %d ta subkategoriya, %d ta mahsulot, %d ta yig'im",
		len(categories), len(subcategories), len(products), len(groupBuys)))

	subcatToCategory := make(map[uuid.UUID]uuid.UUID)
	for _, sub := range subcategories {
		subcatToCategory[sub.id] = sub.categoryID
	}

	if *importCats {
		count, err := importCategories(ctx, pool, categories)
		if err != nil {
			console.Error(fmt.Sprintf("Kategoriyalar importida xato: %v", err))
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("Kategoriyalar saqlandi / yangilandi: %d", count))
	}

	if *importSubcats {
		count, err := importSubcategories(ctx, pool, subcategories)
		if err != nil {
			console.Error(fmt.Sprintf("Subkategoriyalar importida xato: %v", err))
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("Subkategoriyalar saqlandi / yangilandi: %d", count))
	}

	// Agar subkategoriyalar oldindan DB da mavjud bo'lsa, ularning category_id larini ham to'ldirib olamiz
	preloadSubcategories(ctx, pool, subcatToCategory)

	if *importProds {
		count, skipped, err := importProducts(ctx, pool, products, subcatToCategory)
		if err != nil {
			console.Error(fmt.Sprintf("Mahsulotlar importida xato: %v", err))
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("Mahsulotlar saqlandi / yangilandi: %d (o'tkazib yuborilgan: %d)", count, skipped))
	}

	if *importYigims && len(groupBuys) > 0 {
		count, skipped, err := importGroupBuys(ctx, pool, groupBuys, groupBuyItems)
		if err != nil {
			console.Error(fmt.Sprintf("Yig'imlar importida xato: %v", err))
			os.Exit(1)
		}
		console.Success(fmt.Sprintf("Yig'imlar saqlandi / yangilandi: %d (o'tkazib yuborilgan: %d)", count, skipped))
	}

	printSummary(ctx, pool)
	console.Success("Katalog import jarayoni muvaffaqiyatli yakunlandi!")
}

func resolveFilePath(custom string) string {
	if custom != "" {
		abs, err := filepath.Abs(custom)
		if err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
		return custom
	}

	candidates := []string{
		"scripts/yangi.sql",
		"backend/scripts/yangi.sql",
		"../scripts/yangi.sql",
		"../../scripts/yangi.sql",
	}

	for _, cand := range candidates {
		abs, err := filepath.Abs(cand)
		if err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
	}

	return "scripts/yangi.sql"
}

func parseSQLDump(file *os.File) (
	[]rawCategory,
	[]rawSubcategory,
	[]rawProduct,
	[]rawGroupBuy,
	map[uuid.UUID][]rawGroupBuyItem,
	error,
) {
	scanner := bufio.NewScanner(file)
	buf := make([]byte, 1024*1024)
	scanner.Buffer(buf, 10*1024*1024)

	var currentTable string
	var categories []rawCategory
	var subcategories []rawSubcategory
	var products []rawProduct
	var groupBuys []rawGroupBuy
	groupBuyItems := make(map[uuid.UUID][]rawGroupBuyItem)

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "COPY public.") {
			switch {
			case strings.HasPrefix(line, "COPY public.categories "):
				currentTable = "categories"
			case strings.HasPrefix(line, "COPY public.subcategories "):
				currentTable = "subcategories"
			case strings.HasPrefix(line, "COPY public.products "):
				currentTable = "products"
			case strings.HasPrefix(line, "COPY public.group_buys "):
				currentTable = "group_buys"
			case strings.HasPrefix(line, "COPY public.group_buy_items "):
				currentTable = "group_buy_items"
			default:
				currentTable = ""
			}
			continue
		}

		if line == "\\." {
			currentTable = ""
			continue
		}

		if currentTable == "" {
			continue
		}

		parts := strings.Split(line, "\t")
		for i := range parts {
			parts[i] = unescapeCopyField(parts[i])
		}

		switch currentTable {
		case "categories":
			if len(parts) >= 3 {
				id, err := uuid.Parse(parts[0])
				if err != nil {
					continue
				}
				name := strings.TrimSpace(parts[1])
				createdAt := parseTimestamp(parts[2])
				categories = append(categories, rawCategory{
					id:        id,
					name:      name,
					createdAt: createdAt,
				})
			}

		case "subcategories":
			if len(parts) >= 4 {
				id, err := uuid.Parse(parts[0])
				if err != nil {
					continue
				}
				catID, err := uuid.Parse(parts[1])
				if err != nil {
					continue
				}
				name := strings.TrimSpace(parts[2])
				createdAt := parseTimestamp(parts[3])
				subcategories = append(subcategories, rawSubcategory{
					id:         id,
					categoryID: catID,
					name:       name,
					createdAt:  createdAt,
				})
			}

		case "products":
			if len(parts) >= 11 {
				id, err := uuid.Parse(parts[0])
				if err != nil {
					continue
				}
				subcatID, err := uuid.Parse(parts[1])
				if err != nil {
					continue
				}
				name := strings.TrimSpace(parts[2])
				desc := parts[3]
				unitLabel := parts[4]
				price, _ := strconv.ParseInt(parts[5], 10, 64)
				photo := parts[6]
				stock, _ := strconv.Atoi(parts[7])
				active := parts[8] == "t" || parts[8] == "true"
				createdAt := parseTimestamp(parts[9])
				updatedAt := parseTimestamp(parts[10])

				products = append(products, rawProduct{
					id:            id,
					subcategoryID: subcatID,
					name:          name,
					description:   desc,
					unitLabel:     unitLabel,
					priceUzs:      price,
					photoURL:      photo,
					stock:         stock,
					active:        active,
					createdAt:     createdAt,
					updatedAt:     updatedAt,
				})
			}

		case "group_buys":
			if len(parts) >= 16 {
				id, err := uuid.Parse(parts[0])
				if err != nil {
					continue
				}
				title := strings.TrimSpace(parts[1])
				desc := parts[2]
				photo := parts[3]
				unitLabel := parts[4]
				price, _ := strconv.ParseInt(parts[5], 10, 64)
				minVol, _ := strconv.Atoi(parts[6])
				curVol, _ := strconv.Atoi(parts[7])
				status := parts[8]
				createdAt := parseTimestamp(parts[11])
				updatedAt := parseTimestamp(parts[12])

				var prodID *uuid.UUID
				if parts[13] != "" {
					if pid, err := uuid.Parse(parts[13]); err == nil {
						prodID = &pid
					}
				}

				photos := parsePgTextArray(parts[14])
				kind := strings.TrimSpace(parts[15])

				groupBuys = append(groupBuys, rawGroupBuy{
					id:            id,
					title:         title,
					description:   desc,
					photoURL:      photo,
					unitLabel:     unitLabel,
					priceUzs:      price,
					minVolume:     minVol,
					currentVolume: curVol,
					status:        status,
					productID:     prodID,
					photoURLs:     photos,
					kind:          kind,
					createdAt:     createdAt,
					updatedAt:     updatedAt,
				})
			}

		case "group_buy_items":
			if len(parts) >= 3 {
				gbID, err1 := uuid.Parse(parts[0])
				pID, err2 := uuid.Parse(parts[1])
				qty, _ := strconv.Atoi(parts[2])
				if err1 == nil && err2 == nil && qty > 0 {
					groupBuyItems[gbID] = append(groupBuyItems[gbID], rawGroupBuyItem{
						groupBuyID: gbID,
						productID:  pID,
						quantity:   qty,
					})
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, nil, nil, nil, nil, err
	}

	return categories, subcategories, products, groupBuys, groupBuyItems, nil
}

func importCategories(ctx context.Context, pool *pgxpool.Pool, items []rawCategory) (int, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, c := range items {
		_, err := tx.Exec(ctx, `
			INSERT INTO categories (id, name, icon, image, status, created_at, updated_at)
			VALUES ($1, $2, 'tag', '', 'active', $3, $3)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				status = 'active',
				updated_at = NOW()`,
			c.id, c.name, c.createdAt,
		)
		if err != nil {
			return count, fmt.Errorf("kategoriya %s (%s): %w", c.name, c.id, err)
		}
		count++
	}

	return count, tx.Commit(ctx)
}

func importSubcategories(ctx context.Context, pool *pgxpool.Pool, items []rawSubcategory) (int, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, s := range items {
		var catExists bool
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`, s.categoryID).Scan(&catExists)
		if err != nil {
			return count, err
		}
		if !catExists {
			console.Warn(fmt.Sprintf("Subkategoriya '%s' uchun kategoriya (%s) topilmadi, o'tkazib yuborildi", s.name, s.categoryID))
			continue
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO subcategories (id, category_id, name, status, created_at, updated_at)
			VALUES ($1, $2, $3, 'active', $4, $4)
			ON CONFLICT (id) DO UPDATE SET
				category_id = EXCLUDED.category_id,
				name = EXCLUDED.name,
				status = 'active',
				updated_at = NOW()`,
			s.id, s.categoryID, s.name, s.createdAt,
		)
		if err != nil {
			return count, fmt.Errorf("subkategoriya %s (%s): %w", s.name, s.id, err)
		}
		count++
	}

	return count, tx.Commit(ctx)
}

func preloadSubcategories(ctx context.Context, pool *pgxpool.Pool, target map[uuid.UUID]uuid.UUID) {
	rows, err := pool.Query(ctx, `SELECT id, category_id FROM subcategories`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var subID, catID uuid.UUID
		if err := rows.Scan(&subID, &catID); err == nil {
			target[subID] = catID
		}
	}
}

func importProducts(
	ctx context.Context,
	pool *pgxpool.Pool,
	items []rawProduct,
	subcatToCategory map[uuid.UUID]uuid.UUID,
) (imported int, skipped int, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	for _, p := range items {
		catID, ok := subcatToCategory[p.subcategoryID]
		if !ok {
			var fetchedCatID uuid.UUID
			qErr := tx.QueryRow(ctx, `SELECT category_id FROM subcategories WHERE id = $1`, p.subcategoryID).Scan(&fetchedCatID)
			if qErr != nil {
				console.Warn(fmt.Sprintf("Mahsulot '%s' (%s): subkategoriya (%s) bazadan topilmadi", p.name, p.id, p.subcategoryID))
				skipped++
				continue
			}
			catID = fetchedCatID
			subcatToCategory[p.subcategoryID] = catID
		}

		name := strings.TrimSpace(p.name)
		if name == "" {
			name = "Mahsulot"
		}

		deltaBytes := makeQuillDelta(p.description)
		unit := normalizeUnit(p.unitLabel)
		stock := p.stock
		if stock < 0 {
			stock = 0
		}
		price := p.priceUzs
		if price < 0 {
			price = 0
		}

		images := make([]string, 0, 1)
		if normImg := normalizeImageURL(p.photoURL); normImg != "" {
			images = append(images, normImg)
		}
		if len(images) == 0 {
			images = append(images, "/uploads/products/placeholder.webp")
		}

		status := "active"
		if !p.active {
			status = "inactive"
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO products (
				id, category_id, subcategory_id, name, description, unit, unit_size,
				stock, price, images, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, 1.0, $7, $8, $9, $10, $11, $12)
			ON CONFLICT (id) DO UPDATE SET
				category_id = EXCLUDED.category_id,
				subcategory_id = EXCLUDED.subcategory_id,
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				unit = EXCLUDED.unit,
				unit_size = EXCLUDED.unit_size,
				stock = EXCLUDED.stock,
				price = EXCLUDED.price,
				images = EXCLUDED.images,
				status = EXCLUDED.status,
				updated_at = NOW()`,
			p.id, catID, p.subcategoryID, name, string(deltaBytes), unit,
			stock, price, images, status, p.createdAt, p.updatedAt,
		)
		if err != nil {
			return imported, skipped, fmt.Errorf("mahsulot %s (%s): %w", p.name, p.id, err)
		}
		imported++
	}

	return imported, skipped, tx.Commit(ctx)
}

func importGroupBuys(
	ctx context.Context,
	pool *pgxpool.Pool,
	items []rawGroupBuy,
	comboItems map[uuid.UUID][]rawGroupBuyItem,
) (imported int, skipped int, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	for _, gb := range items {
		images := make([]string, 0, 5)
		for _, u := range gb.photoURLs {
			if norm := normalizeImageURL(u); norm != "" {
				images = append(images, norm)
				if len(images) == 5 {
					break
				}
			}
		}
		if len(images) == 0 {
			if norm := normalizeImageURL(gb.photoURL); norm != "" {
				images = append(images, norm)
			}
		}
		if len(images) == 0 {
			images = append(images, "/uploads/products/placeholder.webp")
		}

		targetQty := gb.minVolume
		if targetQty < 1 {
			targetQty = 10
		}
		currentQty := gb.currentVolume
		if currentQty < 0 {
			currentQty = 0
		}

		status := "active"
		if gb.status != "open" {
			status = "inactive"
		}

		isCombo := gb.kind == "combo"
		var yigimType string
		var yigimName *string
		var yigimProductID *uuid.UUID

		if isCombo {
			yigimType = "combo"
			title := strings.TrimSpace(gb.title)
			if title == "" {
				title = "To'plam"
			}
			yigimName = &title
			yigimProductID = nil
		} else {
			yigimType = "single"
			if gb.productID == nil {
				console.Warn(fmt.Sprintf("Yig'im '%s' (%s): product_id yo'q, o'tkazib yuborildi", gb.title, gb.id))
				skipped++
				continue
			}
			var prodExists bool
			_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, *gb.productID).Scan(&prodExists)
			if !prodExists {
				console.Warn(fmt.Sprintf("Yig'im '%s' uchun mahsulot (%s) topilmadi, o'tkazib yuborildi", gb.title, *gb.productID))
				skipped++
				continue
			}
			yigimProductID = gb.productID
			yigimName = nil
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO yigims (
				id, type, name, product_id, target_qty, current_qty, images, status, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (id) DO UPDATE SET
				type = EXCLUDED.type,
				name = EXCLUDED.name,
				product_id = EXCLUDED.product_id,
				target_qty = EXCLUDED.target_qty,
				current_qty = EXCLUDED.current_qty,
				images = EXCLUDED.images,
				status = EXCLUDED.status,
				updated_at = NOW()`,
			gb.id, yigimType, yigimName, yigimProductID, targetQty, currentQty, images, status, gb.createdAt, gb.updatedAt,
		)
		if err != nil {
			return imported, skipped, fmt.Errorf("yig'im %s (%s): %w", gb.title, gb.id, err)
		}

		if isCombo {
			cItems, hasItems := comboItems[gb.id]
			if hasItems && len(cItems) > 0 {
				_, _ = tx.Exec(ctx, `DELETE FROM yigim_items WHERE yigim_id = $1`, gb.id)
				for _, ci := range cItems {
					var pExists bool
					_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, ci.productID).Scan(&pExists)
					if !pExists {
						continue
					}
					_, _ = tx.Exec(ctx, `
						INSERT INTO yigim_items (yigim_id, product_id, qty)
						VALUES ($1, $2, $3)
						ON CONFLICT (yigim_id, product_id) DO UPDATE SET qty = EXCLUDED.qty`,
						gb.id, ci.productID, ci.quantity,
					)
				}
			}
		}

		imported++
	}

	return imported, skipped, tx.Commit(ctx)
}

func printSummary(ctx context.Context, pool *pgxpool.Pool) {
	var catCount, subCount, prodCount, yigimCount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM categories`).Scan(&catCount)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM subcategories`).Scan(&subCount)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM products`).Scan(&prodCount)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM yigims`).Scan(&yigimCount)

	console.Info(fmt.Sprintf("DB joriy holat: %d ta kategoriya · %d ta subkategoriya · %d ta mahsulot · %d ta yig'im",
		catCount, subCount, prodCount, yigimCount))
}

func normalizeUnit(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if strings.Contains(s, "kg") || strings.Contains(s, "кг") {
		return "kg"
	}
	if strings.Contains(s, "litr") || strings.Contains(s, "литр") || strings.Contains(s, "ltr") || strings.Contains(s, "1lr") || strings.Contains(s, " l") || s == "l" || s == "lr" {
		return "litr"
	}
	return "dona"
}

func normalizeImageURL(raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" || u == `\N` {
		return ""
	}
	if idx := strings.Index(u, "/uploads/"); idx != -1 {
		return u[idx:]
	}
	return u
}

func makeQuillDelta(rawText string) []byte {
	txt := strings.TrimSpace(rawText)
	if txt == "" {
		txt = "\n"
	} else if !strings.HasSuffix(txt, "\n") {
		txt += "\n"
	}
	b, _ := json.Marshal(deltaDoc{
		Ops: []deltaOp{{Insert: txt}},
	})
	return b
}

func unescapeCopyField(s string) string {
	if s == `\N` {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	escaped := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if escaped {
			switch c {
			case 'n':
				b.WriteByte('\n')
			case 't':
				b.WriteByte('\t')
			case 'r':
				b.WriteByte('\r')
			case 'b':
				b.WriteByte('\b')
			case 'f':
				b.WriteByte('\f')
			case 'v':
				b.WriteByte('\v')
			case '\\':
				b.WriteByte('\\')
			default:
				b.WriteByte(c)
			}
			escaped = false
		} else if c == '\\' {
			escaped = true
		} else {
			b.WriteByte(c)
		}
	}
	return b.String()
}

func parsePgTextArray(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" || s == `\N` || s == "{}" {
		return nil
	}
	if strings.HasPrefix(s, "{") && strings.HasSuffix(s, "}") {
		s = s[1 : len(s)-1]
	}
	if s == "" {
		return nil
	}
	var items []string
	var cur strings.Builder
	inQuotes := false
	escaped := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if escaped {
			cur.WriteByte(c)
			escaped = false
		} else if c == '\\' {
			escaped = true
		} else if c == '"' {
			inQuotes = !inQuotes
		} else if c == ',' && !inQuotes {
			item := strings.TrimSpace(cur.String())
			if item != "" && item != `\N` {
				items = append(items, item)
			}
			cur.Reset()
		} else {
			cur.WriteByte(c)
		}
	}
	item := strings.TrimSpace(cur.String())
	if item != "" && item != `\N` {
		items = append(items, item)
	}
	return items
}

func parseTimestamp(s string) time.Time {
	s = strings.TrimSpace(s)
	if s == "" || s == `\N` {
		return time.Now()
	}
	formats := []string{
		"2006-01-02 15:04:05.999999-07",
		"2006-01-02 15:04:05.999999+05",
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05-07",
		"2006-01-02 15:04:05",
		time.RFC3339Nano,
		time.RFC3339,
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Now()
}
