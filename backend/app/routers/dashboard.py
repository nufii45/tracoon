from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/households/{household_id}/dashboard",
    tags=["Dashboard"],
)


def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    """Dependency that provides a DashboardService instance."""
    return DashboardService(db)


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    household_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: DashboardService = Depends(get_dashboard_service),
):
    """Get the aggregated dashboard summary for a household.

    Returns spending overview, budget progress, upcoming recurring expenses,
    low-stock inventory items, recent purchases, and contextual quick actions.
    """
    return service.get_summary(household_id, user_id)
