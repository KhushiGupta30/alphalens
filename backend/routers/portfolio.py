from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from routers.auth import get_current_user
from models.user import User, PortfolioHolding
from services.optimizer import optimize_portfolio, analyze_and_optimize

router = APIRouter()

class OptimizeRequest(BaseModel):
    tickers: list[str]

class HoldingInput(BaseModel):
    ticker: str
    quantity: int
    avg_buy_price: float

@router.post("/optimize")
def optimize(request: OptimizeRequest):
    try:
        if len(request.tickers) < 2:
            raise HTTPException(400, "Need at least 2 tickers")
        return optimize_portfolio(request.tickers)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/holding")
def add_holding(
    holding: HoldingInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # update if already exists
        existing = db.query(PortfolioHolding).filter(
            PortfolioHolding.user_id == current_user.id,
            PortfolioHolding.ticker == holding.ticker
        ).first()

        if existing:
            existing.quantity = holding.quantity
            existing.avg_buy_price = holding.avg_buy_price
        else:
            db.add(PortfolioHolding(
                user_id=current_user.id,
                ticker=holding.ticker,
                quantity=holding.quantity,
                avg_buy_price=holding.avg_buy_price
            ))
        db.commit()
        return {"message": f"{holding.ticker} added to portfolio"}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/analyze")
def analyze(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        holdings = db.query(PortfolioHolding).filter(
            PortfolioHolding.user_id == current_user.id
        ).all()

        if len(holdings) < 2:
            raise HTTPException(400, "Add at least 2 holdings to analyze")

        holding_data = [
            {
                "ticker": h.ticker,
                "quantity": h.quantity,
                "avg_buy_price": h.avg_buy_price
            }
            for h in holdings
        ]

        return analyze_and_optimize(holding_data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/holding/{ticker}")
def remove_holding(
    ticker: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        holding = db.query(PortfolioHolding).filter(
            PortfolioHolding.user_id == current_user.id,
            PortfolioHolding.ticker == ticker
        ).first()
        if not holding:
            raise HTTPException(404, "Holding not found")
        db.delete(holding)
        db.commit()
        return {"message": f"{ticker} removed from portfolio"}
    except Exception as e:
        raise HTTPException(500, str(e))