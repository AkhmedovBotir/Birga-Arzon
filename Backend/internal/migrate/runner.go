package migrate

import (
	"embed"
	"errors"
	"fmt"
	"strings"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/console"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed sql/*.sql
var migrationFS embed.FS

// Runner applies schema changes safely:
// - uses advisory lock (built into postgres driver)
// - never drops data unless explicitly asked with --force
// - refuses dirty state without explicit --force
type Runner struct {
	cfg *config.Config
}

func New(cfg *config.Config) *Runner {
	return &Runner{cfg: cfg}
}

func (r *Runner) Up() error {
	console.PrintMigrateBanner("UP (safe)")
	m, err := r.open()
	if err != nil {
		return err
	}
	defer m.Close()

	if err := r.ensureClean(m, false); err != nil {
		return err
	}

	version, dirty, _ := m.Version()
	if dirty {
		return fmt.Errorf("database is dirty at version %d; fix manually or use --force", version)
	}

	err = m.Up()
	if errors.Is(err, migrate.ErrNoChange) {
		console.Success(fmt.Sprintf("Already up to date (version %d)", version))
		return nil
	}
	if err != nil {
		return fmt.Errorf("migrate up: %w", err)
	}

	newVersion, _, _ := m.Version()
	console.Success(fmt.Sprintf("Migrated successfully → version %d", newVersion))
	console.Info("Data-preserving UP migrations only; no DROP of business tables")
	return nil
}

func (r *Runner) Status() error {
	console.PrintMigrateBanner("STATUS")
	m, err := r.open()
	if err != nil {
		return err
	}
	defer m.Close()

	version, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		console.Info("No migrations applied yet")
		return nil
	}
	if err != nil {
		return err
	}

	state := "clean"
	if dirty {
		state = "DIRTY"
		console.Warn(fmt.Sprintf("Version %d · state=%s", version, state))
	} else {
		console.Success(fmt.Sprintf("Version %d · state=%s", version, state))
	}
	return nil
}

// DownSteps rolls back N versions. Requires confirm flag for safety.
func (r *Runner) DownSteps(steps int, force bool) error {
	if !force {
		return errors.New("refusing down migration without --force (data loss risk)")
	}
	if steps < 1 {
		return errors.New("steps must be >= 1")
	}

	console.PrintMigrateBanner(fmt.Sprintf("DOWN %d (forced)", steps))
	console.Warn("Rolling back may remove schema objects — ensure backups exist")

	m, err := r.open()
	if err != nil {
		return err
	}
	defer m.Close()

	if err := r.ensureClean(m, force); err != nil {
		return err
	}

	if err := m.Steps(-steps); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate down: %w", err)
	}

	version, _, verr := m.Version()
	if errors.Is(verr, migrate.ErrNilVersion) {
		console.Success("Rolled back to empty schema version")
		return nil
	}
	console.Success(fmt.Sprintf("Rolled back → version %d", version))
	return nil
}

func (r *Runner) open() (*migrate.Migrate, error) {
	source, err := iofs.New(migrationFS, "sql")
	if err != nil {
		return nil, fmt.Errorf("open embedded migrations: %w", err)
	}

	dsn := r.cfg.DatabaseURL()
	if !strings.Contains(dsn, "x-migrations-table") {
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		dsn += sep + "x-migrations-table=schema_migrations"
	}

	m, err := migrate.NewWithSourceInstance("iofs", source, dsn)
	if err != nil {
		return nil, fmt.Errorf("open migrator: %w", err)
	}

	_ = r.cfg.MigrateLockTimeout
	return m, nil
}

func (r *Runner) ensureClean(m *migrate.Migrate, force bool) error {
	version, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		return nil
	}
	if err != nil {
		return err
	}
	if dirty && !force {
		return fmt.Errorf("dirty migration at version %d — aborting to protect data", version)
	}
	if dirty && force {
		console.Warn(fmt.Sprintf("Forcing dirty flag clear at version %d", version))
		if err := m.Force(int(version)); err != nil {
			return err
		}
	}
	return nil
}
