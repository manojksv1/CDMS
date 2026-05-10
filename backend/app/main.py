import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.limiter import limiter
from app.core.logging_config import configure_logging

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for managing client installations, locations, and tasks.",
    version="1.0.0",
    # Disable default /docs in production if needed — keep enabled for now
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate limiter ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Centralised exception handlers ---
register_exception_handlers(app)

# --- Routers ---
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["health"])
def read_root():
    return {"message": "Welcome to the Installation Tracking System API"}


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy"}
