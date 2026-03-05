.PHONY: sqlc

SQLC := $(or $(shell command -v sqlc),$(shell go env GOBIN)/sqlc)

sqlc:
	@$(SQLC) generate
