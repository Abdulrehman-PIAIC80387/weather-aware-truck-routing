# Weather-Aware Truck Routing

Monorepo boilerplate.

- **Backend:** Django, Django REST Framework, drf-spectacular (Swagger / ReDoc), SQLite
- **Frontend:** React 18 + TypeScript + Vite + Leaflet, served by nginx
- **Everything runs in Docker**

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

| URL | What |
|-----|------|
| http://localhost:3020 | Web app |
| http://localhost:8020/api/ | API root |
| http://localhost:8020/api/docs/ | Swagger UI |
| http://localhost:8020/api/redoc/ | ReDoc |

## Project layout

```
backend/
├── config/      settings, URLs (DRF router), Swagger configuration
├── routes/      routing and the route plan API
└── weather/     weather forecasts and hazard rules
frontend/src/
├── api/         HTTP client
├── hooks/
├── components/
├── types/
└── utils/
docs/            Postman collection
```

## Development

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 8020
```

Frontend (in another terminal):

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, /api is proxied to :8020
```

Lint and tests:

```bash
cd backend
ruff format --check . && ruff check .
python manage.py test
```
