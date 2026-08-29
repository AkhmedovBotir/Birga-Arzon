package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"jamaoxarid/backend/internal/authkit"
	"jamaoxarid/backend/internal/httpx"
	"jamaoxarid/backend/internal/models"
	"jamaoxarid/backend/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ctxKey string

const userKey ctxKey = "user"

type Handler struct {
	App *service.App
}

func UserFrom(ctx context.Context) *models.User {
	u, _ := ctx.Value(userKey).(*models.User)
	return u
}

func ptrID(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func courierRegion(u *models.User) *string {
	if u == nil || u.Role != "courier" {
		return nil
	}
	if u.RegionID == nil || strings.TrimSpace(*u.RegionID) == "" {
		return nil
	}
	return u.RegionID
}

func (h *Handler) Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		raw = strings.TrimSpace(raw)
		if raw == "" {
			httpx.Error(w, http.StatusUnauthorized, "Kirish talab qilinadi")
			return
		}
		c, err := authkit.ParseToken(h.App.Cfg.JWTSecret, raw)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "Token yaroqsiz")
			return
		}
		u, err := h.App.Store.UserByID(r.Context(), c.UserID)
		if err != nil || u == nil {
			httpx.Error(w, http.StatusUnauthorized, "Foydalanuvchi topilmadi")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey, u)))
	})
}

func (h *Handler) Role(roles ...string) func(http.Handler) http.Handler {
	allow := map[string]struct{}{}
	for _, r := range roles {
		allow[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := UserFrom(r.Context())
			if u == nil {
				httpx.Error(w, http.StatusUnauthorized, "Kirish talab qilinadi")
				return
			}
			if _, ok := allow[u.Role]; !ok {
				httpx.Error(w, http.StatusForbidden, "Ruxsat yo‘q")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (h *Handler) RequestSMS(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	if err := h.App.RequestSMS(r.Context(), body.Phone); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"sent": true, "code": h.App.Cfg.DefaultOTP})
}

func (h *Handler) VerifySMS(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone     string `json:"phone"`
		Code      string `json:"code"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	u, tok, needsProfile, err := h.App.VerifySMS(r.Context(), body.Phone, body.Code, body.FirstName, body.LastName)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	if needsProfile {
		httpx.JSON(w, 200, map[string]any{"needsProfile": true})
		return
	}
	httpx.JSON(w, 200, map[string]any{"token": tok, "user": u})
}

func (h *Handler) Telegram(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone      string `json:"phone"`
		TelegramID *int64 `json:"telegramId"`
		FirstName  string `json:"firstName"`
		LastName   string `json:"lastName"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	u, tok, err := h.App.TelegramAuth(r.Context(), body.Phone, body.TelegramID, body.FirstName, body.LastName)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"token": tok, "user": u})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone    string `json:"phone"`
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	u, tok, err := h.App.LoginPassword(r.Context(), body.Phone, body.Username, body.Password, body.Role)
	if err != nil {
		httpx.Error(w, 401, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"token": tok, "user": u})
}

func (h *Handler) CheckPhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	phone, err := authkit.NormalizeUZPhone(body.Phone)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	u, err := h.App.Store.UserByPhone(r.Context(), phone)
	if err != nil {
		httpx.Error(w, 500, "Server xatosi")
		return
	}
	httpx.JSON(w, 200, map[string]any{"exists": u != nil, "role": func() string {
		if u == nil {
			return ""
		}
		return u.Role
	}()})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, 200, UserFrom(r.Context()))
}

func (h *Handler) PatchMe(w http.ResponseWriter, r *http.Request) {
	u := UserFrom(r.Context())
	var body struct {
		FirstName       *string  `json:"firstName"`
		LastName        *string  `json:"lastName"`
		RegionID        *string  `json:"regionId"`
		CityID          *string  `json:"cityId"`
		MfyID           *string  `json:"mfyId"`
		DeliveryLat     *float64 `json:"deliveryLat"`
		DeliveryLng     *float64 `json:"deliveryLng"`
		DeliveryAddress *string  `json:"deliveryAddress"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	first, last := u.FirstName, u.LastName
	if body.FirstName != nil {
		first = strings.TrimSpace(*body.FirstName)
	}
	if body.LastName != nil {
		last = strings.TrimSpace(*body.LastName)
	}
	city, mfy := u.CityID, u.MfyID
	region := u.RegionID
	if body.RegionID != nil {
		region = body.RegionID
	}
	if body.CityID != nil {
		city = body.CityID
	}
	if body.MfyID != nil {
		mfy = body.MfyID
	}
	lat, lng, addr := u.DeliveryLat, u.DeliveryLng, u.DeliveryAddress
	if body.DeliveryLat != nil {
		lat = body.DeliveryLat
	}
	if body.DeliveryLng != nil {
		lng = body.DeliveryLng
	}
	if body.DeliveryAddress != nil {
		addr = body.DeliveryAddress
	}
	nu, err := h.App.Store.UpdateProfile(r.Context(), u.ID, first, last, region, city, mfy, lat, lng, addr)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, nu)
}

func (h *Handler) Cities(w http.ResponseWriter, r *http.Request) {
	regionID := r.URL.Query().Get("regionId")
	if regionID == "" {
		regionID = chi.URLParam(r, "regionId")
	}
	items, err := h.App.Store.Cities(r.Context(), regionID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) Regions(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Regions(r.Context())
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) Mfys(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.MfysByCity(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) GroupBuys(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	u := UserFrom(r.Context())
	if u != nil && u.Role == "customer" && status == "" {
		status = "open"
	}
	items, err := h.App.Store.ListGroupBuys(r.Context(), status)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) GroupBuy(w http.ResponseWriter, r *http.Request) {
	g, err := h.App.Store.GroupBuy(r.Context(), chi.URLParam(r, "id"))
	if err != nil || g == nil {
		httpx.Error(w, 404, "Yig‘im topilmadi")
		return
	}
	httpx.JSON(w, 200, g)
}

func (h *Handler) Cart(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Cart(r.Context(), UserFrom(r.Context()).ID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) PutCart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		GroupBuyID string `json:"groupBuyId"`
		Quantity   int    `json:"quantity"`
		Add        bool   `json:"add"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || body.GroupBuyID == "" {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	g, err := h.App.Store.GroupBuy(r.Context(), body.GroupBuyID)
	if err != nil || g == nil {
		httpx.Error(w, 404, "Yig‘im topilmadi")
		return
	}
	if g.Status != "open" && (body.Quantity > 0 || body.Add) {
		httpx.Error(w, 400, "Yig‘im yopilgan")
		return
	}
	userID := UserFrom(r.Context()).ID
	maxQty := models.MaxSellQty(g.Stock, g.CurrentVolume)
	cur, err := h.App.Store.CartItemQty(r.Context(), userID, body.GroupBuyID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	qty := body.Quantity
	if body.Add {
		addQty := body.Quantity
		if addQty <= 0 {
			addQty = 1
		}
		if cur >= maxQty {
			httpx.Error(w, 400, fmt.Sprintf("Ko‘pi bilan %d %s qo‘shish mumkin", maxQty, g.UnitLabel))
			return
		}
		qty = cur + addQty
	}
	if qty > maxQty {
		qty = maxQty
	}
	if err := h.App.Store.UpsertCart(r.Context(), userID, body.GroupBuyID, qty, false); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	h.Cart(w, r)
}

func (h *Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DeliveryMethod string `json:"deliveryMethod"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	o, err := h.App.Checkout(r.Context(), UserFrom(r.Context()), body.DeliveryMethod)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, o)
}

func (h *Handler) Orders(w http.ResponseWriter, r *http.Request) {
	if err := h.App.SplitMixedOrders(r.Context()); err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	items, err := h.App.Store.ListOrdersByUser(r.Context(), UserFrom(r.Context()).ID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) Order(w http.ResponseWriter, r *http.Request) {
	o, err := h.App.Store.Order(r.Context(), chi.URLParam(r, "id"))
	u := UserFrom(r.Context())
	if err != nil || o == nil || (u.Role == "customer" && o.UserID != u.ID) {
		httpx.Error(w, 404, "Buyurtma topilmadi")
		return
	}
	httpx.JSON(w, 200, o)
}

func (h *Handler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	if err := h.App.CancelOrder(r.Context(), UserFrom(r.Context()).ID, chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"cancelled": true})
}

func (h *Handler) Pay(w http.ResponseWriter, r *http.Request) {
	httpx.Error(w, 400, "To‘lov bu oqimda yo‘q — kuryer qabul qilgach kod chiqadi")
}

func (h *Handler) COD(w http.ResponseWriter, r *http.Request) {
	httpx.Error(w, 400, "To‘lov bu oqimda yo‘q — kuryer qabul qilgach kod chiqadi")
}

func (h *Handler) PickupCode(w http.ResponseWriter, r *http.Request) {
	u := UserFrom(r.Context())
	id := chi.URLParam(r, "id")
	code, err := h.App.EnsurePickupCode(r.Context(), u.ID, id)
	if err != nil {
		msg := err.Error()
		status := 400
		if msg == "buyurtma topilmadi" {
			status = 404
		}
		httpx.Error(w, status, msg)
		return
	}
	o, _ := h.App.Store.Order(r.Context(), id)
	st := ""
	if o != nil {
		st = o.Status
	}
	httpx.JSON(w, 200, map[string]any{"code": code, "orderId": id, "status": st})
}

func (h *Handler) Notifications(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Notifications(r.Context(), UserFrom(r.Context()).ID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) AdminCreateRegion(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Code string `json:"code"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	reg, err := h.App.Store.CreateRegion(r.Context(), body.Name, body.Code)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, reg)
}

func (h *Handler) AdminUpdateRegion(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Code string `json:"code"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	if err := h.App.Store.UpdateRegion(r.Context(), chi.URLParam(r, "id"), body.Name, body.Code); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminDeleteRegion(w http.ResponseWriter, r *http.Request) {
	if err := h.App.Store.DeleteRegion(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminCreateCity(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		RegionID string `json:"regionId"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	var regionID *string
	if body.RegionID != "" {
		regionID = &body.RegionID
	}
	c, err := h.App.Store.CreateCity(r.Context(), body.Name, regionID)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, c)
}

func (h *Handler) AdminUpdateCity(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	if err := h.App.Store.UpdateCity(r.Context(), chi.URLParam(r, "id"), body.Name); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminDeleteCity(w http.ResponseWriter, r *http.Request) {
	if err := h.App.Store.DeleteCity(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminCreateMfy(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CityID        string   `json:"cityId"`
		Name          string   `json:"name"`
		PickupAddress string   `json:"pickupAddress"`
		Lat           *float64 `json:"lat"`
		Lng           *float64 `json:"lng"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || body.CityID == "" || body.Name == "" {
		httpx.Error(w, 400, "Shahar va nom kerak")
		return
	}
	m, err := h.App.Store.CreateMfy(r.Context(), body.CityID, body.Name, body.PickupAddress, body.Lat, body.Lng)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, m)
}

func (h *Handler) AdminUpdateMfy(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string `json:"name"`
		PickupAddress string `json:"pickupAddress"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	if err := h.App.Store.UpdateMfy(r.Context(), chi.URLParam(r, "id"), body.Name, body.PickupAddress); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminDeleteMfy(w http.ResponseWriter, r *http.Request) {
	if err := h.App.Store.DeleteMfy(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u, err := h.App.Store.UserByID(r.Context(), id)
	if err != nil || u == nil || u.Role != "customer" {
		httpx.Error(w, 404, "Mijoz topilmadi")
		return
	}
	if err := h.App.Store.DeleteCustomer(r.Context(), id); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	items, err := h.App.Store.ListUsers(r.Context(), q.Get("cityId"), q.Get("mfyId"), q.Get("q"))
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) AdminOrders(w http.ResponseWriter, r *http.Request) {
	if err := h.App.SplitMixedOrders(r.Context()); err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	items, err := h.App.Store.ListOrders(r.Context(), r.URL.Query().Get("status"))
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) AdminWarehouse(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Leftovers(r.Context())
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) AdminStats(w http.ResponseWriter, r *http.Request) {
	st, err := h.App.Store.Stats(r.Context())
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, st)
}

func (h *Handler) Issue(w http.ResponseWriter, r *http.Request) {
	u := UserFrom(r.Context())
	if u != nil && u.Role == "courier" && courierRegion(u) == nil {
		httpx.Error(w, 400, "Kuryerga viloyat biriktirilmagan. Admin viloyat va tumanni belgilasin.")
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Kod kerak")
		return
	}
	o, err := h.App.IssueByCode(r.Context(), body.Code, courierRegion(UserFrom(r.Context())))
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, o)
}

func (h *Handler) CourierDeliveries(w http.ResponseWriter, r *http.Request) {
	if err := h.App.SplitMixedOrders(r.Context()); err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	u := UserFrom(r.Context())
	region := courierRegion(u)
	needArea := u != nil && u.Role == "courier" && region == nil
	regionID := ""
	if region != nil {
		regionID = *region
	}

	area := map[string]any{}
	if u != nil {
		if u.RegionName != nil {
			area["regionName"] = *u.RegionName
		}
		if u.CityName != nil {
			area["cityName"] = *u.CityName
		}
	}

	if needArea {
		httpx.JSON(w, 200, map[string]any{
			"open":     []any{},
			"waiting":  []any{},
			"active":   []any{},
			"needArea": true,
			"area":     area,
		})
		return
	}

	openOrders, err := h.App.Store.ListOrdersByRegion(r.Context(), "collecting", regionID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	closed, err := h.App.Store.ListGroupBuys(r.Context(), "closed")
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	fulfilling, err := h.App.Store.ListGroupBuys(r.Context(), "in_fulfillment")
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	waiting := []map[string]any{}
	for _, g := range append(closed, fulfilling...) {
		orders, _ := h.App.Store.OrdersForGroupBuy(r.Context(), g.ID)
		mine := []models.Order{}
		for _, o := range orders {
			if regionID != "" && (o.RegionID == nil || *o.RegionID != regionID) {
				continue
			}
			if o.Status != "awaiting_courier" && o.Status != "collecting" {
				continue
			}
			mine = append(mine, o)
		}
		if len(mine) == 0 {
			continue
		}
		waiting = append(waiting, map[string]any{"collection": g, "orders": mine})
	}
	active, err := h.App.Store.ListOrdersByRegion(r.Context(), "with_courier", regionID)
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{
		"open":     openOrders,
		"waiting":  waiting,
		"active":   active,
		"needArea": false,
		"area":     area,
	})
}

func (h *Handler) CourierAccept(w http.ResponseWriter, r *http.Request) {
	u := UserFrom(r.Context())
	if u != nil && u.Role == "courier" && courierRegion(u) == nil {
		httpx.Error(w, 400, "Kuryerga viloyat biriktirilmagan. Admin viloyat va tumanni belgilasin.")
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.App.AcceptOrder(r.Context(), id, courierRegion(u)); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

type offerLine struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

func (h *Handler) CreateGroupBuy(w http.ResponseWriter, r *http.Request) {
	if strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		var body struct {
			Title                 string `json:"title"`
			Description           string `json:"description"`
			UnitLabel             string `json:"unitLabel"`
			UnitPriceUzs          int64  `json:"unitPriceUzs"`
			MinVolume             int    `json:"minVolume"`
			CashOnDeliveryAllowed bool   `json:"cashOnDeliveryAllowed"`
			PhotoURL              string   `json:"photoUrl"`
			PhotoURLs             []string `json:"photoUrls"`
			ProductID             string `json:"productId"`
			Kind                  string `json:"kind"`
			Items                 []offerLine `json:"items"`
		}
		if err := httpx.DecodeLoose(r, &body); err != nil {
			httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
			return
		}
		if body.MinVolume <= 0 {
			body.MinVolume = 1
		}
		g := models.GroupBuy{
			Title: strings.TrimSpace(body.Title), Description: body.Description, UnitLabel: body.UnitLabel,
			UnitPriceUzs: body.UnitPriceUzs, MinVolume: body.MinVolume, CashOnDeliveryAllowed: body.CashOnDeliveryAllowed,
		}
		if body.PhotoURL != "" {
			g.PhotoURL = &body.PhotoURL
		}
		if len(body.PhotoURLs) > 0 {
			g.PhotoURLs = body.PhotoURLs
			if g.PhotoURL == nil {
				g.PhotoURL = &body.PhotoURLs[0]
			}
		}
		if err := h.applyOfferJSON(r, &g, body.Kind, body.ProductID, body.Items); err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		fillPhotosFromItems(&g)
		if len(g.PhotoURLs) < 1 || len(g.PhotoURLs) > 5 {
			httpx.Error(w, 400, "1 tadan 5 tagacha rasm yuklang")
			return
		}
		if strings.TrimSpace(g.Title) == "" {
			httpx.Error(w, 400, "Sarlavha kerak")
			return
		}
		if g.UnitLabel == "" {
			g.UnitLabel = "kg"
		}
		created, err := h.App.Store.CreateGroupBuy(r.Context(), g, UserFrom(r.Context()).ID)
		if err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		httpx.JSON(w, 200, created)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		_ = r.ParseForm()
	}
	title := strings.TrimSpace(firstVal(r, "title"))
	price, _ := strconv.ParseInt(firstVal(r, "unitPriceUzs"), 10, 64)
	min, _ := strconv.Atoi(firstVal(r, "minVolume"))
	if min <= 0 {
		min = 1
	}
	g := models.GroupBuy{
		Title:       title,
		Description: firstVal(r, "description"),
		UnitLabel:   firstVal(r, "unitLabel"),
		UnitPriceUzs: price,
		MinVolume:   min,
		CashOnDeliveryAllowed: firstVal(r, "cashOnDeliveryAllowed") == "true" || firstVal(r, "cashOnDeliveryAllowed") == "1",
	}
	urls := h.readPhotoSlots(r)
	g.PhotoURLs = urls
	if len(urls) > 0 {
		g.PhotoURL = &urls[0]
	}
	if err := h.applyOffer(r, &g, firstVal(r, "kind"), firstVal(r, "productId"), firstVal(r, "items")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	fillPhotosFromItems(&g)
	if len(g.PhotoURLs) < 1 || len(g.PhotoURLs) > 5 {
		httpx.Error(w, 400, "1 tadan 5 tagacha rasm yuklang")
		return
	}
	g.PhotoURL = &g.PhotoURLs[0]
	if strings.TrimSpace(g.Title) == "" {
		httpx.Error(w, 400, "Sarlavha kerak")
		return
	}
	if g.UnitLabel == "" {
		g.UnitLabel = "kg"
	}
	created, err := h.App.Store.CreateGroupBuy(r.Context(), g, UserFrom(r.Context()).ID)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, created)
}

func (h *Handler) applyProduct(r *http.Request, g *models.GroupBuy, productID string) error {
	productID = strings.TrimSpace(productID)
	if productID == "" {
		return fmt.Errorf("mahsulot tanlang")
	}
	p, err := h.App.Store.Product(r.Context(), productID)
	if err != nil || p == nil {
		return fmt.Errorf("mahsulot topilmadi")
	}
	g.Kind = "product"
	g.ProductID = &p.ID
	g.Items = []models.GroupBuyItem{{ProductID: p.ID, Quantity: 1, Name: p.Name, UnitLabel: p.UnitLabel, UnitPriceUzs: p.UnitPriceUzs, Stock: p.Stock, PhotoURL: p.PhotoURL}}
	if strings.TrimSpace(g.Title) == "" {
		g.Title = p.Name
	}
	if strings.TrimSpace(g.Description) == "" {
		g.Description = p.Description
	}
	if strings.TrimSpace(g.UnitLabel) == "" {
		g.UnitLabel = p.UnitLabel
	}
	g.UnitPriceUzs = p.UnitPriceUzs
	g.Stock = p.Stock
	if g.PhotoURL == nil {
		g.PhotoURL = p.PhotoURL
	}
	return nil
}

func (h *Handler) applyOffer(r *http.Request, g *models.GroupBuy, kind, productID, itemsJSON string) error {
	kind = strings.ToLower(strings.TrimSpace(kind))
	if kind == "combo" {
		var lines []offerLine
		if strings.TrimSpace(itemsJSON) != "" {
			if err := json.Unmarshal([]byte(itemsJSON), &lines); err != nil {
				return fmt.Errorf("combo mahsulotlari noto‘g‘ri")
			}
		}
		return h.applyCombo(r, g, lines)
	}
	return h.applyProduct(r, g, productID)
}

func (h *Handler) applyOfferJSON(r *http.Request, g *models.GroupBuy, kind, productID string, lines []offerLine) error {
	kind = strings.ToLower(strings.TrimSpace(kind))
	if kind == "combo" {
		return h.applyCombo(r, g, lines)
	}
	return h.applyProduct(r, g, productID)
}

func (h *Handler) applyCombo(r *http.Request, g *models.GroupBuy, lines []offerLine) error {
	seen := map[string]int{}
	var items []models.GroupBuyItem
	var price int64
	for _, line := range lines {
		pid := strings.TrimSpace(line.ProductID)
		qty := line.Quantity
		if qty <= 0 {
			qty = 1
		}
		if pid == "" {
			continue
		}
		if _, ok := seen[pid]; ok {
			return fmt.Errorf("combo ichida bir mahsulot takrorlanmasin")
		}
		p, err := h.App.Store.Product(r.Context(), pid)
		if err != nil || p == nil {
			return fmt.Errorf("mahsulot topilmadi")
		}
		seen[pid] = qty
		items = append(items, models.GroupBuyItem{
			ProductID: p.ID, Name: p.Name, UnitLabel: p.UnitLabel,
			UnitPriceUzs: p.UnitPriceUzs, Quantity: qty, Stock: p.Stock, PhotoURL: p.PhotoURL,
		})
		price += p.UnitPriceUzs * int64(qty)
	}
	if len(items) < 2 {
		return fmt.Errorf("comboda kamida 2 ta mahsulot bo‘lsin")
	}
	g.Kind = "combo"
	g.Items = items
	g.ProductID = &items[0].ProductID
	g.UnitPriceUzs = price
	if strings.TrimSpace(g.UnitLabel) == "" {
		g.UnitLabel = "to‘plam"
	}
	if strings.TrimSpace(g.Title) == "" {
		names := make([]string, 0, len(items))
		for _, it := range items {
			names = append(names, it.Name)
		}
		g.Title = strings.Join(names, " + ")
	}
	g.ApplySellStock()
	return nil
}

func fillPhotosFromItems(g *models.GroupBuy) {
	if len(g.PhotoURLs) >= 1 {
		return
	}
	seen := map[string]struct{}{}
	for _, it := range g.Items {
		if it.PhotoURL == nil {
			continue
		}
		u := strings.TrimSpace(*it.PhotoURL)
		if u == "" {
			continue
		}
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		g.PhotoURLs = append(g.PhotoURLs, u)
		if len(g.PhotoURLs) >= 5 {
			break
		}
	}
	if len(g.PhotoURLs) > 0 {
		g.PhotoURL = &g.PhotoURLs[0]
	}
}

func (h *Handler) readPhotoSlots(r *http.Request) []string {
	urls := make([]string, 0, 5)
	for i := 0; i < 5; i++ {
		f, hdr, err := r.FormFile(fmt.Sprintf("photo_%d", i))
		if err == nil {
			url, err2 := h.saveUpload(f, hdr.Filename)
			_ = f.Close()
			if err2 == nil && url != "" {
				urls = append(urls, url)
				continue
			}
		}
		if keep := strings.TrimSpace(firstVal(r, fmt.Sprintf("keep_%d", i))); keep != "" {
			urls = append(urls, keep)
		}
	}
	return urls
}

func (h *Handler) saveUpload(src io.Reader, filename string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		ext = ".jpg"
	}
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		ext = ".jpg"
	}
	if err := os.MkdirAll("uploads", 0o755); err != nil {
		return "", err
	}
	name := uuid.NewString() + ext
	dst, err := os.Create(filepath.Join("uploads", name))
	if err != nil {
		return "", err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}
	return h.App.Cfg.PublicURL + "/uploads/" + name, nil
}

func firstVal(r *http.Request, k string) string {
	if r.MultipartForm != nil && r.MultipartForm.Value != nil {
		if v := r.MultipartForm.Value[k]; len(v) > 0 {
			return v[0]
		}
	}
	return r.FormValue(k)
}

func (h *Handler) CloseGroupBuy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.App.CloseCollection(r.Context(), id); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) ReadyGroupBuy(w http.ResponseWriter, r *http.Request) {
	h.CloseGroupBuy(w, r)
}

func (h *Handler) CancelGroupBuy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.App.CancelCollection(r.Context(), id); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) UpdateGroupBuy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	cur, err := h.App.Store.GroupBuy(r.Context(), id)
	if err != nil || cur == nil {
		httpx.Error(w, 404, "Yig‘im topilmadi")
		return
	}
	if cur.Status != "open" {
		httpx.Error(w, 400, "faqat ochiq yig‘imni tahrirlash mumkin")
		return
	}
	_ = r.ParseMultipartForm(32 << 20)
	g := *cur
	if title := strings.TrimSpace(firstVal(r, "title")); title != "" {
		g.Title = title
	}
	min, _ := strconv.Atoi(firstVal(r, "minVolume"))
	if min > 0 {
		g.MinVolume = min
	}
	urls := h.readPhotoSlots(r)
	g.PhotoURLs = urls
	if len(urls) > 0 {
		g.PhotoURL = &urls[0]
	}
	if err := h.applyOffer(r, &g, firstVal(r, "kind"), firstVal(r, "productId"), firstVal(r, "items")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	fillPhotosFromItems(&g)
	if len(g.PhotoURLs) < 1 || len(g.PhotoURLs) > 5 {
		httpx.Error(w, 400, "1 tadan 5 tagacha rasm yuklang")
		return
	}
	g.PhotoURL = &g.PhotoURLs[0]
	if err := h.App.Store.UpdateGroupBuy(r.Context(), g); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	updated, _ := h.App.Store.GroupBuy(r.Context(), id)
	httpx.JSON(w, 200, updated)
}

func (h *Handler) DeleteGroupBuy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	g, err := h.App.Store.GroupBuy(r.Context(), id)
	if err != nil || g == nil {
		httpx.Error(w, 404, "Yig‘im topilmadi")
		return
	}
	if err := h.App.Store.DeleteGroupBuy(r.Context(), id); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func phoneBusy(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "users_phone") || strings.Contains(s, "duplicate key") || strings.Contains(s, "unique")
}

func (h *Handler) AdminCouriers(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.ListByRole(r.Context(), "courier")
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) AdminCreateCourier(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone     string `json:"phone"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Password  string `json:"password"`
		RegionID  string `json:"regionId"`
		CityID    string `json:"cityId"`
		MfyID     string `json:"mfyId"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	phone, err := authkit.NormalizeUZPhone(body.Phone)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	first := strings.TrimSpace(body.FirstName)
	last := strings.TrimSpace(body.LastName)
	if first == "" || last == "" {
		httpx.Error(w, 400, "Ism va familiya kerak")
		return
	}
	if strings.TrimSpace(body.CityID) == "" || strings.TrimSpace(body.RegionID) == "" {
		httpx.Error(w, 400, "Viloyat va tuman kerak")
		return
	}
	if len(strings.TrimSpace(body.Password)) < 6 {
		httpx.Error(w, 400, "Parol kamida 6 belgi")
		return
	}
	if existing, _ := h.App.Store.UserByPhone(r.Context(), phone); existing != nil {
		httpx.Error(w, 400, "Bu telefon band")
		return
	}
	hash, err := authkit.HashPassword(body.Password)
	if err != nil {
		httpx.Error(w, 500, "Parolni yozib bo‘lmadi")
		return
	}
	u, err := h.App.Store.CreateStaff(r.Context(), "courier", phone, first, last, hash, ptrID(body.RegionID), ptrID(body.CityID), nil)
	if err != nil {
		if phoneBusy(err) {
			httpx.Error(w, 400, "Bu telefon band")
			return
		}
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, u)
}

func (h *Handler) AdminUpdateCourier(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Phone     string `json:"phone"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Password  string `json:"password"`
		RegionID  string `json:"regionId"`
		CityID    string `json:"cityId"`
		MfyID     string `json:"mfyId"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil {
		httpx.Error(w, 400, "Noto‘g‘ri so‘rov")
		return
	}
	u, err := h.App.Store.UserByID(r.Context(), id)
	if err != nil || u == nil || u.Role != "courier" {
		httpx.Error(w, 404, "Kuryer topilmadi")
		return
	}
	phone := u.Phone
	if strings.TrimSpace(body.Phone) != "" {
		p, err := authkit.NormalizeUZPhone(body.Phone)
		if err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		phone = p
	}
	first := strings.TrimSpace(body.FirstName)
	last := strings.TrimSpace(body.LastName)
	if first == "" {
		first = u.FirstName
	}
	if last == "" {
		last = u.LastName
	}
	regionID := ptrID(body.RegionID)
	cityID := ptrID(body.CityID)
	if regionID == nil {
		regionID = u.RegionID
	}
	if cityID == nil {
		cityID = u.CityID
	}
	if regionID == nil || cityID == nil {
		httpx.Error(w, 400, "Viloyat va tuman kerak")
		return
	}
	if existing, _ := h.App.Store.UserByPhone(r.Context(), phone); existing != nil && existing.ID != id {
		httpx.Error(w, 400, "Bu telefon band")
		return
	}
	var hash *string
	if pw := strings.TrimSpace(body.Password); pw != "" {
		if len(pw) < 6 {
			httpx.Error(w, 400, "Parol kamida 6 belgi")
			return
		}
		hsh, err := authkit.HashPassword(pw)
		if err != nil {
			httpx.Error(w, 500, "Parolni yozib bo‘lmadi")
			return
		}
		hash = &hsh
	}
	if err := h.App.Store.UpdateStaff(r.Context(), id, first, last, phone, regionID, cityID, nil, hash); err != nil {
		if phoneBusy(err) {
			httpx.Error(w, 400, "Bu telefon band")
			return
		}
		httpx.Error(w, 400, err.Error())
		return
	}
	updated, _ := h.App.Store.UserByID(r.Context(), id)
	httpx.JSON(w, 200, updated)
}

func (h *Handler) AdminDeleteCourier(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u, err := h.App.Store.UserByID(r.Context(), id)
	if err != nil || u == nil || u.Role != "courier" {
		httpx.Error(w, 404, "Kuryer topilmadi")
		return
	}
	if err := h.App.Store.DeleteCourier(r.Context(), id); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) MockPayPage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := h.App.Store.Payment(r.Context(), id)
	if err != nil || p == nil {
		http.Error(w, "To‘lov topilmadi", 404)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>To‘lov</title>
<style>body{font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f0fdf4}
.card{background:#fff;padding:32px;border-radius:24px;max-width:420px;text-align:center;box-shadow:0 8px 30px #0001}
button{background:#16a34a;color:#fff;border:0;padding:14px 24px;border-radius:14px;font-size:16px;cursor:pointer;width:100%}
</style></head><body><div class="card">
<h2>` + strings.ToUpper(p.Provider) + ` to‘lov</h2>
<p>Summa: <b>` + strconv.FormatInt(p.AmountUzs, 10) + ` so‘m</b></p>
<form method="post" action="/pay/mock/` + p.ID + `/confirm"><button type="submit">To‘lovni tasdiqlash</button></form>
</div></body></html>`))
}

func (h *Handler) MockPayConfirm(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "To‘lov bu oqimda ishlatilmaydi", 400)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, 200, map[string]any{"ok": true, "time": time.Now()})
}
