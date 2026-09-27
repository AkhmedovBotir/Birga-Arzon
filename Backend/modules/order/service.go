package order

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"birgaarzon/backend/internal/config"
	usermod "birgaarzon/backend/modules/user"

	"github.com/google/uuid"
)

type MinOrderReader interface {
	MinOrderAmount(ctx context.Context) (float64, error)
	DeliveryFee(ctx context.Context) (float64, error)
}

type Service struct {
	repo     *Repository
	cfg      *config.Config
	settings MinOrderReader
}

func NewService(repo *Repository, cfg *config.Config, settings MinOrderReader) *Service {
	return &Service{repo: repo, cfg: cfg, settings: settings}
}

func (s *Service) Create(ctx context.Context, user *usermod.User, req CreateRequest) (*Order, error) {
	if user == nil {
		return nil, errors.New("unauthorized")
	}
	if !user.ProfileComplete {
		return nil, errors.New("profil to‘liq emas")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("savat bo‘sh")
	}

	items := make([]OrderItem, 0, len(req.Items))
	bump := map[uuid.UUID]int{}
	var total float64

	seen := map[uuid.UUID]bool{}
	for _, in := range req.Items {
		yid, err := uuid.Parse(strings.TrimSpace(in.YigimID))
		if err != nil {
			return nil, errors.New("yig‘im noto‘g‘ri")
		}
		if in.Qty < 1 {
			return nil, errors.New("miqdor kamida 1")
		}
		if seen[yid] {
			return nil, errors.New("bir yig‘im bir marta qo‘shiladi")
		}
		seen[yid] = true

		y, err := s.repo.GetYigimForOrder(ctx, yid)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return nil, errors.New("yig‘im topilmadi")
			}
			return nil, err
		}
		if y.Status != "active" {
			return nil, fmt.Errorf("%s yopiq", y.Name)
		}

		it := OrderItem{
			YigimID:     y.ID,
			ProductID:   y.ProductID,
			ProductName: y.Name,
			Unit:        y.Unit,
			UnitPrice:   y.Price,
			Qty:         in.Qty,
			Image:       y.Image,
		}
		items = append(items, it)
		total += y.Price * float64(in.Qty)
		bump[yid] += in.Qty
	}

	var deliveryFee float64
	if s.settings != nil {
		minAmt, err := s.settings.MinOrderAmount(ctx)
		if err != nil {
			return nil, err
		}
		if minAmt > 0 && total < minAmt {
			return nil, fmt.Errorf(
				"minimal buyurtma summasi %.0f so‘m (hozir: %.0f)",
				minAmt,
				total,
			)
		}
		deliveryFee, _ = s.settings.DeliveryFee(ctx)
	}

	code, err := randomCode4()
	if err != nil {
		return nil, err
	}

	var viloyatName, tumanName string
	if user.ViloyatID != nil {
		viloyatName, _ = s.repo.RegionName(ctx, *user.ViloyatID)
	}
	if user.TumanID != nil {
		tumanName, _ = s.repo.RegionName(ctx, *user.TumanID)
	}

	o := &Order{
		UserID:        user.ID,
		Status:        StatusWaiting,
		DeliveryCode:  code,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Phone:         user.Phone,
		ViloyatID:     user.ViloyatID,
		TumanID:       user.TumanID,
		ViloyatName:   viloyatName,
		TumanName:     tumanName,
		Lat:           user.Lat,
		Lng:           user.Lng,
		TotalAmount:   total,
		DeliveryFee:   deliveryFee,
		PaymentStatus: PaymentUnpaid,
		Note:          strings.TrimSpace(req.Note),
	}

	if err := s.repo.Create(ctx, o, items, bump); err != nil {
		return nil, err
	}
	// Yig‘im to‘lib yopilgan bo‘lsa — bog‘liq buyurtmalarni tayyor qilib kuryerga yuborish
	for yid := range bump {
		y, err := s.repo.GetYigimForOrder(ctx, yid)
		if err == nil && y.Status != "active" {
			_ = s.OnYigimClosed(ctx, yid)
		}
	}
	created, err := s.repo.Get(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	if created.Status == StatusReady && created.KuryerID == nil {
		if assigned, aerr := s.AutoAssign(ctx, created.ID); aerr == nil {
			return assigned, nil
		}
	}
	return created, nil
}

func (s *Service) ListMine(ctx context.Context, userID uuid.UUID) ([]Order, error) {
	return s.repo.ListByUser(ctx, userID)
}

func (s *Service) GetMine(ctx context.Context, userID, id uuid.UUID) (*Order, error) {
	o, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if o.UserID != userID {
		return nil, ErrNotFound
	}
	return o, nil
}

func (s *Service) ListAdmin(ctx context.Context, status, q string) ([]Order, error) {
	return s.repo.ListAdmin(ctx, status, q)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*Order, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	return s.repo.Stats(ctx)
}

func (s *Service) Assign(ctx context.Context, orderID, kuryerID uuid.UUID) (*Order, error) {
	ok, err := s.repo.KuryerExists(ctx, kuryerID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("kuryer topilmadi yoki faol emas")
	}
	o, err := s.repo.Get(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != StatusReady && o.Status != StatusAssigned {
		return nil, errors.New("buyurtma hali kuryerga tayyor emas")
	}
	return s.repo.Assign(ctx, orderID, kuryerID)
}

func (s *Service) AutoAssign(ctx context.Context, orderID uuid.UUID) (*Order, error) {
	o, err := s.repo.Get(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status == StatusAssigned && o.KuryerID != nil {
		return o, nil
	}
	if o.Status == StatusWaiting {
		o, err = s.repo.SetStatus(ctx, orderID, StatusReady)
		if err != nil {
			return nil, err
		}
	}
	if o.Status != StatusReady && o.Status != StatusAssigned {
		return nil, errors.New("buyurtma kuryerga yuborish uchun tayyor emas")
	}
	kid, err := s.repo.FindCourierForRegion(ctx, o.TumanID, o.ViloyatID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, errors.New("mijoz hududida faol kuryer topilmadi")
		}
		return nil, err
	}
	return s.repo.Assign(ctx, orderID, *kid)
}

func (s *Service) autoAssignReadyOrders(ctx context.Context, yigimID *uuid.UUID) error {
	ids, err := s.repo.ListReadyUnassignedIDs(ctx, yigimID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := s.AutoAssign(ctx, id); err != nil {
			// Hududda kuryer bo‘lmasa ready qoladi — keyinroq qo‘lda
			continue
		}
	}
	return nil
}

func (s *Service) Unassign(ctx context.Context, orderID uuid.UUID) (*Order, error) {
	return s.repo.Unassign(ctx, orderID)
}

func (s *Service) SetStatus(ctx context.Context, orderID uuid.UUID, status string) (*Order, error) {
	switch status {
	case StatusCancelled, StatusReady, StatusWaiting:
		// ok
	default:
		return nil, errors.New("status o‘zgartirib bo‘lmaydi")
	}
	o, err := s.repo.Get(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status == StatusDelivered {
		return nil, errors.New("yetkazilgan buyurtmani o‘zgartirib bo‘lmaydi")
	}
	if status == StatusCancelled && o.Status == StatusDelivered {
		return nil, errors.New("yetkazilgan buyurtmani bekor qilib bo‘lmaydi")
	}
	updated, err := s.repo.SetStatus(ctx, orderID, status)
	if err != nil {
		return nil, err
	}
	if status == StatusReady {
		if assigned, aerr := s.AutoAssign(ctx, orderID); aerr == nil {
			return assigned, nil
		}
	}
	return updated, nil
}

func (s *Service) ListKuryer(ctx context.Context, kuryerID uuid.UUID, history bool) ([]Order, error) {
	return s.repo.ListByKuryer(ctx, kuryerID, history)
}

func (s *Service) Deliver(ctx context.Context, kuryerID, orderID uuid.UUID, code string) (*Order, error) {
	code = strings.TrimSpace(code)
	if len(code) != 4 {
		return nil, errors.New("4 xonali kod kiriting")
	}
	o, err := s.repo.Get(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.PaymentStatus != PaymentPaid && o.PaymentStatus != PaymentCOD {
		return nil, errors.New("buyurtma hali to‘lanmagan — kod berilmaydi")
	}
	return s.repo.Deliver(ctx, orderID, kuryerID, code)
}

func (s *Service) KuryerStats(ctx context.Context, kuryerID uuid.UUID) (assigned, delivered int, err error) {
	return s.repo.KuryerStats(ctx, kuryerID)
}

func (s *Service) OnYigimClosed(ctx context.Context, yigimID uuid.UUID) error {
	if err := s.repo.MarkReadyForYigim(ctx, yigimID); err != nil {
		return err
	}
	return s.autoAssignReadyOrders(ctx, &yigimID)
}

func randomCode4() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(9000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", n.Int64()+1000), nil
}
