 # Finzova Backend

Backend foundation for Finzova, an India-first financial copilot.

## Local runtime

Use Docker because the target runtime is Python 3.12+:

```bash
docker compose up --build
```

## Migrations

```bash
cd finzova/backend
alembic upgrade head
```
