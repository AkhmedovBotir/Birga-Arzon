package kuryer

import (
	"context"
	"errors"
	"strings"
	"time"

	"birgaarzon/backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *Repository
	cfg  *config.Config
}

func NewService(repo *Repository, cfg *config.Config) *Service {
	return &Service{repo: repo, cfg: cfg}
}

type Claims struct {
	KuryerID string `json:"kuryer_id"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func (s *Service) List(ctx context.Context, q string) ([]Kuryer, error) {
	return s.repo.List(ctx, strings.TrimSpace(q))
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	return s.repo.Stats(ctx)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*Kuryer, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (*Kuryer, error) {
	phone, err := NormalizePhone(req.Phone)
	if err != nil {
		return nil, err
	}
	pass := strings.TrimSpace(req.Password)
	if len(pass) < 4 {
		return nil, errors.New("parol kamida 4 belgi bo‘lsin")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	viloyatID, tumanID, err := s.parseRegions(ctx, req.ViloyatID, req.TumanID)
	if err != nil {
		return nil, err
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	k := &Kuryer{
		FirstName:    strings.TrimSpace(req.FirstName),
		LastName:     strings.TrimSpace(req.LastName),
		Phone:        phone,
		PasswordHash: string(hash),
		ViloyatID:    viloyatID,
		TumanID:      tumanID,
		IsActive:     active,
	}
	if k.FirstName == "" {
		return nil, errors.New("ism majburiy")
	}
	if err := s.repo.Create(ctx, k); err != nil {
		if isUnique(err) {
			return nil, errors.New("bu telefon band")
		}
		return nil, err
	}
	return s.repo.Get(ctx, k.ID)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateRequest) (*Kuryer, error) {
	existing, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	phone, err := NormalizePhone(req.Phone)
	if err != nil {
		return nil, err
	}
	viloyatID, tumanID, err := s.parseRegions(ctx, req.ViloyatID, req.TumanID)
	if err != nil {
		return nil, err
	}
	existing.FirstName = strings.TrimSpace(req.FirstName)
	existing.LastName = strings.TrimSpace(req.LastName)
	existing.Phone = phone
	existing.ViloyatID = viloyatID
	existing.TumanID = tumanID
	existing.IsActive = req.IsActive
	if existing.FirstName == "" {
		return nil, errors.New("ism majburiy")
	}

	updatePass := false
	pass := strings.TrimSpace(req.Password)
	if pass != "" {
		if len(pass) < 4 {
			return nil, errors.New("parol kamida 4 belgi bo‘lsin")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		existing.PasswordHash = string(hash)
		updatePass = true
	}

	if err := s.repo.Update(ctx, id, existing, updatePass); err != nil {
		if isUnique(err) {
			return nil, errors.New("bu telefon band")
		}
		return nil, err
	}
	return s.repo.Get(ctx, id)
}

func (s *Service) SetActive(ctx context.Context, id uuid.UUID, active bool) (*Kuryer, error) {
	return s.repo.SetActive(ctx, id, active)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) Login(ctx context.Context, phone, password string) (*LoginResponse, error) {
	norm, err := NormalizePhone(phone)
	if err != nil {
		return nil, errors.New("telefon yoki parol noto‘g‘ri")
	}
	k, err := s.repo.FindByPhone(ctx, norm)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errors.New("telefon yoki parol noto‘g‘ri")
		}
		return nil, err
	}
	if !k.IsActive {
		return nil, errors.New("hisob o‘chirilgan")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(k.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("telefon yoki parol noto‘g‘ri")
	}
	token, err := s.issueToken(k)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{Token: token, Kuryer: k.Public()}, nil
}

func (s *Service) Me(ctx context.Context, id uuid.UUID) (*Kuryer, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Dashboard(ctx context.Context, id uuid.UUID) (*Dashboard, error) {
	k, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	var pending, completed int
	_ = s.repo.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'assigned'),
			COUNT(*) FILTER (WHERE status = 'delivered')
		FROM orders WHERE kuryer_id = $1`, id).Scan(&pending, &completed)
	hint := "Yangi topshiriqlar «Buyurtmalar» bo‘limida"
	if pending == 0 {
		hint = "Hozircha faol buyurtma yo‘q"
	}
	return &Dashboard{
		Kuryer:     k.Public(),
		Deliveries: pending + completed,
		Pending:    pending,
		Completed:  completed,
		TodayHint:  hint,
	}, nil
}

func (s *Service) issueToken(k *Kuryer) (string, error) {
	hours := s.cfg.JWTExpiresHours
	if hours <= 0 {
		hours = 72
	}
	claims := Claims{
		KuryerID: k.ID.String(),
		Phone:    k.Phone,
		Role:     "kuryer",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(hours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   k.ID.String(),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*Claims)
	if !ok || !t.Valid || claims.Role != "kuryer" {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *Service) parseRegions(ctx context.Context, viloyatRaw, tumanRaw *string) (*uuid.UUID, *uuid.UUID, error) {
	var viloyatID, tumanID *uuid.UUID
	if viloyatRaw != nil && strings.TrimSpace(*viloyatRaw) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*viloyatRaw))
		if err != nil {
			return nil, nil, errors.New("viloyat noto‘g‘ri")
		}
		ok, err := s.repo.RegionExists(ctx, id, "viloyat")
		if err != nil {
			return nil, nil, err
		}
		if !ok {
			return nil, nil, errors.New("viloyat topilmadi")
		}
		viloyatID = &id
	}
	if tumanRaw != nil && strings.TrimSpace(*tumanRaw) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*tumanRaw))
		if err != nil {
			return nil, nil, errors.New("tuman noto‘g‘ri")
		}
		ok, err := s.repo.RegionExists(ctx, id, "tuman")
		if err != nil {
			return nil, nil, err
		}
		if !ok {
			return nil, nil, errors.New("tuman topilmadi")
		}
		if viloyatID == nil {
			return nil, nil, errors.New("tuman uchun viloyat tanlang")
		}
		tumanID = &id
	}
	return viloyatID, tumanID, nil
}

func isUnique(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
