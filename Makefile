.PHONY: validate install uninstall reinstall clean test help

MARKETPLACE := slidev-dev-marketplace
PLUGIN := slidev@$(MARKETPLACE)

# Validate plugin manifests
validate:
	claude plugin validate ./
	claude plugin validate ./slidev/

# Install or reinstall plugin (handles both fresh install and updates)
install:
	@# Add or update marketplace
	@if claude plugin marketplace list 2>/dev/null | grep -q "$(MARKETPLACE)"; then \
		echo "Updating marketplace..."; \
		claude plugin marketplace update $(MARKETPLACE); \
	else \
		echo "Adding marketplace..."; \
		claude plugin marketplace add ./; \
	fi
	@# Remove existing plugin if installed
	@if claude plugin list 2>/dev/null | grep -q "$(PLUGIN)"; then \
		echo "Removing existing plugin..."; \
		claude plugin rm $(PLUGIN) 2>/dev/null || true; \
	fi
	@echo "Installing plugin..."
	@claude plugin install $(PLUGIN)

# Remove plugin and marketplace
uninstall:
	@echo "Removing plugin..."
	@claude plugin rm $(PLUGIN) 2>/dev/null || echo "Plugin not installed"
	@echo "Removing marketplace..."
	@claude plugin marketplace rm $(MARKETPLACE) 2>/dev/null || echo "Marketplace not installed"

# Full clean reinstall (removes marketplace too)
reinstall: uninstall install

# Remove generated files
clean:
	find . -name ".DS_Store" -delete

# Run tests (unit always; render integration with RUN_RENDER_TESTS=1)
test:
	node --test tests/balance/unit/
	@if [ "$(RUN_RENDER_TESTS)" = "1" ]; then \
		bash tests/balance/render.test.sh; \
	else \
		echo "Skipping render tests (set RUN_RENDER_TESTS=1 to run them)"; \
	fi

# Show available targets
help:
	@echo "Available targets:"
	@echo "  validate    - Validate plugin manifests using claude plugin validate"
	@echo "  install     - Install or update plugin"
	@echo "  uninstall   - Remove plugin and marketplace"
	@echo "  reinstall   - Full clean reinstall (removes marketplace too)"
	@echo "  clean       - Remove generated files"
	@echo "  test        - Run unit tests (RUN_RENDER_TESTS=1 adds render tests)"
