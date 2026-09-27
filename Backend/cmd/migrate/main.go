package main

import (
	"flag"
	"fmt"
	"os"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/console"
	"birgaarzon/backend/internal/migrate"
)

func main() {
	up := flag.Bool("up", true, "apply pending UP migrations (default, safe)")
	status := flag.Bool("status", false, "show migration version")
	down := flag.Int("down", 0, "roll back N versions (requires --force)")
	force := flag.Bool("force", false, "allow dangerous operations (down / dirty fix)")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}

	runner := migrate.New(cfg)

	switch {
	case *status:
		err = runner.Status()
	case *down > 0:
		err = runner.DownSteps(*down, *force)
	case *up:
		err = runner.Up()
	default:
		err = fmt.Errorf("nothing to do")
	}

	if err != nil {
		console.Error(err.Error())
		os.Exit(1)
	}
}
