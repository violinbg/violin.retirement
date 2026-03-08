.PHONY: build build-ui build-server dev dev-ui dev-server clean

# Build everything
build: build-ui build-server

# Build the Angular UI
build-ui:
	cd ui && npm run build

# Build the Go server (requires UI to be built first)
build-server:
	go build -o violin.retirement.exe .

# Run Angular dev server with API proxy
dev-ui:
	cd ui && npx ng serve --proxy-config proxy.conf.json

# Run Go server in development mode
dev-server:
	go run . -addr :8080

# Run both (use two terminals or a process manager)
dev:
	@echo "Run 'make dev-server' and 'make dev-ui' in separate terminals"

clean:
	rm -rf ui/dist
	rm -f violin.retirement.exe
	rm -f violin.retirement.db
