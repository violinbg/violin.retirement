package main

import (
	"embed"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/violinbg/violin.retirement/internal/database"
	"github.com/violinbg/violin.retirement/internal/server"
)

//go:embed all:ui/dist/browser
var uiFS embed.FS

//go:embed migrations/*.sql
var migrationsFS embed.FS

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dbPath := flag.String("db", "violin.retirement.db", "SQLite database path")
	flag.Parse()

	db, err := database.Open(*dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	if err := database.Migrate(db, migrationsFS); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	srv := server.New(db, uiFS)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("server listening on %s", *addr)
		if err := srv.Run(*addr); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down...")
}
