.PHONY: validate install uninstall reinstall clean help

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

# Show available targets
help:
	@echo "Available targets:"
	@echo "  validate    - Validate plugin manifests using claude plugin validate"
	@echo "  install     - Install or update plugin"
	@echo "  uninstall   - Remove plugin and marketplace"
	@echo "  reinstall   - Full clean reinstall (removes marketplace too)"
	@echo "  clean       - Remove generated files"
