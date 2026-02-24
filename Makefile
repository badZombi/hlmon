# Cross-compilation targets for the Go agent
BINARY_NAME := homelab-agent
SRC_DIR := ./agent

.PHONY: all clean build-linux-amd64 build-linux-arm64 build-darwin-amd64 build-darwin-arm64 build-windows-amd64

all: build-linux-amd64 build-linux-arm64 build-darwin-amd64 build-darwin-arm64 build-windows-amd64

clean:
	rm -rf dist/

build-linux-amd64:
	@echo "Building for linux/amd64..."
	@mkdir -p dist
	cd $(SRC_DIR) && GOOS=linux GOARCH=amd64 go build -o ../dist/$(BINARY_NAME)-linux-amd64 .

build-linux-arm64:
	@echo "Building for linux/arm64 (Raspberry Pi)..."
	@mkdir -p dist
	cd $(SRC_DIR) && GOOS=linux GOARCH=arm64 go build -o ../dist/$(BINARY_NAME)-linux-arm64 .

build-darwin-amd64:
	@echo "Building for darwin/amd64..."
	@mkdir -p dist
	cd $(SRC_DIR) && GOOS=darwin GOARCH=amd64 go build -o ../dist/$(BINARY_NAME)-darwin-amd64 .

build-darwin-arm64:
	@echo "Building for darwin/arm64 (Apple Silicon)..."
	@mkdir -p dist
	cd $(SRC_DIR) && GOOS=darwin GOARCH=arm64 go build -o ../dist/$(BINARY_NAME)-darwin-arm64 .

build-windows-amd64:
	@echo "Building for windows/amd64..."
	@mkdir -p dist
	cd $(SRC_DIR) && GOOS=windows GOARCH=amd64 go build -o ../dist/$(BINARY_NAME)-windows-amd64.exe .

server-install:
	@echo "Installing server dependencies..."
	cd server && npm install

server-dev:
	@echo "Starting server in dev mode..."
	cd server && npm run dev
