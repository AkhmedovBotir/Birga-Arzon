package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"birgaarzon/backend/internal/config"
	usermod "birgaarzon/backend/modules/user"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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
	AdminID  string `json:"admin_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func (s *Service) CreateGeneral(ctx context.Context, firstName, lastName, phone, username, password string) (*Admin, error) {
	count, err := s.repo.CountByRole(ctx, RoleGeneral)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrGeneralExists
	}
	return s.create(ctx, firstName, lastName, phone, username, password, RoleGeneral, nil)
}

func (s *Service) CreateAdminByGeneral(ctx context.Context, creator *Admin, req CreateAdminRequest) (*Admin, error) {
	if creator.Role != RoleGeneral {
		return nil, errors.New("only general can create admins")
	}
	creatorID := creator.ID
	return s.create(ctx, req.FirstName, req.LastName, req.Phone, req.Username, req.Password, RoleAdmin, &creatorID)
}

func (s *Service) create(ctx context.Context, firstName, lastName, phone, username, password, role string, createdBy *uuid.UUID) (*Admin, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil, errors.New("username required")
	}
	if strings.TrimSpace(password) == "" {
		return nil, errors.New("password required")
	}

	normPhone, err := usermod.NormalizePhone(phone)
	if err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	a := &Admin{
		FirstName:    strings.TrimSpace(firstName),
		LastName:     strings.TrimSpace(lastName),
		Phone:        normPhone,
		Role:         role,
		Username:     username,
		PasswordHash: string(hash),
		CreatedBy:    createdBy,
	}
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) Login(ctx context.Context, username, password string) (*LoginResponse, error) {
	a, err := s.repo.FindByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errors.New("invalid username or password")
		}
		return nil, err
	}
	if !a.IsActive {
		return nil, errors.New("account disabled")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(a.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid username or password")
	}

	token, err := s.issueToken(a)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{Token: token, Admin: a.Public()}, nil
}

func (s *Service) Me(ctx context.Context, id uuid.UUID) (*Admin, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) List(ctx context.Context) ([]PublicAdmin, error) {
	list, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PublicAdmin, 0, len(list))
	for _, a := range list {
		out = append(out, a.Public())
	}
	return out, nil
}

func (s *Service) UpdateAdmin(ctx context.Context, actor *Admin, id uuid.UUID, req UpdateAdminRequest) (*Admin, error) {
	if actor.Role != RoleGeneral {
		return nil, errors.New("only general can update admins")
	}

	target, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if target.Role == RoleGeneral && actor.ID != target.ID {
		return nil, errors.New("cannot update another general")
	}

	target.FirstName = strings.TrimSpace(req.FirstName)
	target.LastName = strings.TrimSpace(req.LastName)
	normPhone, err := usermod.NormalizePhone(req.Phone)
	if err != nil {
		return nil, err
	}
	target.Phone = normPhone
	username := strings.TrimSpace(req.Username)
	if username == "" {
		return nil, errors.New("username required")
	}
	target.Username = username

	if req.IsActive != nil {
		if target.Role == RoleGeneral && !*req.IsActive {
			return nil, errors.New("cannot deactivate general")
		}
		target.IsActive = *req.IsActive
	}

	passwordHash := ""
	if strings.TrimSpace(req.Password) != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		passwordHash = string(hash)
	}
	target.PasswordHash = passwordHash

	if err := s.repo.Update(ctx, target); err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, id)
}

func (s *Service) DeleteAdmin(ctx context.Context, actor *Admin, id uuid.UUID) error {
	if actor.Role != RoleGeneral {
		return errors.New("only general can delete admins")
	}
	if actor.ID == id {
		return errors.New("cannot delete yourself")
	}
	target, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if target.Role == RoleGeneral {
		return errors.New("cannot delete general")
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) issueToken(a *Admin) (string, error) {
	claims := Claims{
		AdminID:  a.ID.String(),
		Username: a.Username,
		Role:     a.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.cfg.JWTExpiresHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   a.ID.String(),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
