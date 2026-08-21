.PHONY: run tidy import-regions

tidy:
	go mod tidy

run:
	go run ./cmd/api

import-regions:
	go run ./cmd/importregions -file scripts/ttsa.regions.json
