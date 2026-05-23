.PHONY: test-ci-build build-macos build-macos-arm build-macos-x86 build-windows build-all release

VERSION ?= $(shell node -p "require('./src-tauri/tauri.conf.json').version")

test-ci-build:
	# 1. Clean old dependencies and build artifacts
	rm -rf node_modules release dist
	# 2. Install dependencies (strict, same as CI)
	pnpm install --frozen-lockfile
	# 3. Build production assets
	pnpm run build:docker
	# 4. Package the dist folder into a tarball (same as CI)
	mkdir -p release
	tar -czvf release/build.tar.gz ./dist
	cd release && shasum -a 256 build.tar.gz > sha256.txt && cd ..
	@echo "✅ CI build simulation complete: release/build.tar.gz"
	# 5. Serve the dist directory to verify in browser
	pnpm dlx serve ./dist -l 5179 -s --cors

build-macos-arm:
	bun install --frozen-lockfile
	bun run build
	bunx tauri build --target aarch64-apple-darwin

build-macos-x86:
	bun install --frozen-lockfile
	bun run build
	bunx tauri build --target x86_64-apple-darwin

build-macos: build-macos-arm build-macos-x86

build-windows:
	bun install --frozen-lockfile
	bun run build
	bunx tauri build

build-all: build-macos build-windows

release:
	@echo "Releasing v$(VERSION)..."
	git add -A
	git diff --cached --quiet || git commit -m "chore: release $(VERSION)"
	git push origin main
	@if git rev-parse v$(VERSION) >/dev/null 2>&1; then \
		git tag -d v$(VERSION); \
		git push origin :refs/tags/v$(VERSION); \
	fi
	git tag v$(VERSION)
	git push origin v$(VERSION)
	@echo "✅ Released v$(VERSION)"