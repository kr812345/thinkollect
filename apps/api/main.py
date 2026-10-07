import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.config import get_settings
from src.routers import auth, thought

logging.basicConfig(level=logging.INFO)

settings = get_settings()

app = FastAPI(title="Thinkollect Server")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- Security headers ---
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


# --- Error handling: consistent, non-leaky error bodies ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Strip raw exception context / internal values from error details.
    errors = [
        {"loc": [str(loc) for loc in err.get("loc", [])], "msg": err.get("msg", "")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


# --- Routers (contract base URL: /api) ---
app.include_router(auth.router, prefix="/api")
app.include_router(thought.router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "Thinkollect API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
