from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from routers.auth import get_current_user
from models.user import User, WatchlistItem

router = APIRouter()


@router.get("/")
def get_watchlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(WatchlistItem).filter(WatchlistItem.user_id == current_user.id).all()
    return {"watchlist": [{"ticker": i.ticker, "added_at": str(i.added_at)} for i in items]}


@router.post("/{ticker}")
def add_to_watchlist(ticker: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exists = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == current_user.id,
        WatchlistItem.ticker == ticker.upper()
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Already in watchlist")
    db.add(WatchlistItem(user_id=current_user.id, ticker=ticker.upper()))
    db.commit()
    return {"message": f"{ticker.upper()} added to watchlist"}


@router.delete("/{ticker}")
def remove_from_watchlist(ticker: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(WatchlistItem).filter(
        WatchlistItem.user_id == current_user.id,
        WatchlistItem.ticker == ticker.upper()
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    db.delete(item)
    db.commit()
    return {"message": f"{ticker.upper()} removed from watchlist"}