# Finna Backend

Backend foundation for Finna, an India-first financial copilot.

## Local runtime

Use Docker because the target runtime is Python 3.12+:

```bash
docker compose up --build
```

## Migrations

```bash
cd finna/backend
alembic upgrade head
```
