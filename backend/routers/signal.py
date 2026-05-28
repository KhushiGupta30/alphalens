from fastapi import APIRouter, HTTPException
from services.ml_service import get_signal
from routers.stock import resolve_ticker

router = APIRouter()

@router.get("/{ticker}")
def signal(ticker: str):
    try:
        return get_signal(resolve_ticker(ticker))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))