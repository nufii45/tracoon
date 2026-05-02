from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.household import router as household_router
from app.routers.category import router as category_router
from app.routers.expense import router as expense_router
from app.routers.budget import router as budget_router
from app.routers.inventory import router as inventory_router
from app.routers.purchase import router as purchase_router
from app.routers.recurring_expense import router as recurring_expense_router
from app.routers.dashboard import router as dashboard_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(auth_router)
app.include_router(household_router)
app.include_router(category_router)
app.include_router(expense_router)
app.include_router(budget_router)
app.include_router(inventory_router)
app.include_router(purchase_router)
app.include_router(recurring_expense_router)
app.include_router(dashboard_router)


# --- Health Check ---
@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}
