from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
from routers import auth, transactions, agents, copilot, goals, dashboard

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description='Agentic AI Personal Finance Copilot — Powered by LangGraph',
)

# ── CORS — allow all localhost origins ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── Global exception handler so CORS headers are always present ───────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


app.include_router(auth.router,         prefix="/auth")
app.include_router(transactions.router, prefix="/transactions")
app.include_router(agents.router,       prefix="/agents")
app.include_router(copilot.router,      prefix="/copilot")
app.include_router(goals.router,        prefix="/goals")
app.include_router(dashboard.router,    prefix="/dashboard")


@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "version": settings.VERSION, "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
