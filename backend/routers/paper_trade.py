from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from services.paper_trade_service import execute_trade, get_portfolio
from routers.auth import get_current_user
from models.user import User

router = APIRouter()

@router.post("/trade/{ticker}")
def trade(
    ticker: str,
    action: str,  # BUY or SELL
    quantity: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        if action.upper() not in ["BUY", "SELL"]:
            raise HTTPException(400, "Action must be BUY or SELL")
        return execute_trade(current_user.id, ticker, action.upper(), quantity, db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/portfolio")
def portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return get_portfolio(current_user.id, db)
    except Exception as e:
        raise HTTPException(500, str(e))