BACKEND_DIR := backend
FRONTEND_DIR := frontend

.PHONY: backend frontend install lint format test docker

backend:
	cd $(BACKEND_DIR) && uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd $(FRONTEND_DIR) && npm run dev

install:
	cd $(BACKEND_DIR) && pip install -r requirements.txt
	cd $(FRONTEND_DIR) && npm install

lint:
	cd $(BACKEND_DIR) && ruff check .

format:
	cd $(BACKEND_DIR) && ruff format .

test:
	cd $(BACKEND_DIR) && pip install -q pytest pytest-mock httpx && pytest -v

docker:
	docker compose up --build
