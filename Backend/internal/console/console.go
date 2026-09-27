package console

import (
	"fmt"
	"strings"
	"time"
)

const (
	reset   = "\033[0m"
	bold    = "\033[1m"
	dim     = "\033[2m"
	cyan    = "\033[36m"
	green   = "\033[32m"
	yellow  = "\033[33m"
	magenta = "\033[35m"
	blue    = "\033[34m"
	white   = "\033[37m"
	red     = "\033[31m"
)

type StartupInfo struct {
	AppName   string
	Env       string
	Addr      string
	DBHost    string
	DBName    string
	Modules   []string
	Swagger   string
	StartedAt time.Time
}

func PrintBanner(info StartupInfo) {
	width := 62
	inner := width - 2
	line := strings.Repeat("═", inner)

	fmt.Println()
	fmt.Print(bold + cyan)
	fmt.Println("╔" + line + "╗")
	fmt.Println("║" + center(inner, "BIRGA ARZON") + "║")
	fmt.Println("║" + center(inner, "Modular Monolith API") + "║")
	fmt.Println("╚" + line + "╝")
	fmt.Print(reset)
	fmt.Println()

	row("App", info.AppName, green)
	row("Env", info.Env, yellow)
	row("Listen", "http://"+info.Addr, blue)
	row("Database", fmt.Sprintf("%s / %s", info.DBHost, info.DBName), magenta)
	row("Modules", strings.Join(info.Modules, " · "), cyan)
	row("Swagger", info.Swagger, green)
	row("Started", info.StartedAt.Format("2006-01-02 15:04:05"), white)
	fmt.Println()
	fmt.Println(bold + green + "▸" + reset + dim + " Ready. Waiting for requests…" + reset)
	fmt.Println()
}

func PrintMigrateBanner(action string) {
	fmt.Println()
	fmt.Println(bold + magenta + "┌──────────────────────────────────────────────┐" + reset)
	fmt.Printf("%s%s│%s  Safe Migrate · %-28s%s│%s\n", bold, magenta, reset+bold, action, reset+magenta+bold, reset)
	fmt.Println(bold + magenta + "└──────────────────────────────────────────────┘" + reset)
	fmt.Println()
}

func PrintResetBanner(dbName string) {
	fmt.Println()
	fmt.Println(bold + red + "┌──────────────────────────────────────────────┐" + reset)
	fmt.Printf("%s%s│%s  Reset Database · %-26s%s│%s\n", bold, red, reset+bold, dbName, reset+red+bold, reset)
	fmt.Println(bold + red + "└──────────────────────────────────────────────┘" + reset)
	fmt.Println()
}

func Success(msg string) {
	fmt.Println(bold + green + "✓" + reset + " " + msg)
}

func Info(msg string) {
	fmt.Println(bold + cyan + "ℹ" + reset + " " + msg)
}

func Warn(msg string) {
	fmt.Println(bold + yellow + "!" + reset + " " + msg)
}

func Error(msg string) {
	fmt.Println(bold + red + "✗" + reset + " " + msg)
}

func row(label, value, color string) {
	fmt.Printf("  %s%-12s%s %s%s%s%s\n", dim, label, reset, bold, color, value, reset)
}

func center(width int, text string) string {
	if len(text) >= width {
		return text[:width]
	}
	pad := width - len(text)
	left := pad / 2
	right := pad - left
	return strings.Repeat(" ", left) + text + strings.Repeat(" ", right)
}
