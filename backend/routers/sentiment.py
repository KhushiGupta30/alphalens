from fastapi import APIRouter, HTTPException
from services.sentiment_service import get_sentiment

router = APIRouter()

@router.get("/{company}")
def sentiment(company: str):
    try:
        return get_sentiment(company)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))