from fastapi import APIRouter, HTTPException
from services.stock_service import get_overview, get_technicals
import yfinance as yf

router = APIRouter()

def resolve_ticker(ticker: str) -> str:
    t = ticker.upper()
    # If already has exchange suffix, use as-is
    if "." in t:
        return t
    # Try as US ticker first
    data = yf.Ticker(t).history(period="5d")
    if not data.empty:
        return t
    # Fallback to NSE
    return t + ".NS"

@router.get("/{ticker}/overview")
def overview(ticker: str):
    try:
        return get_overview(resolve_ticker(ticker))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ticker}/technicals")
def technicals(ticker: str):
    try:
        return get_technicals(resolve_ticker(ticker))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/{ticker}/technical-signal")
def technical_signal(ticker: str):
    try:
        from services.technical_signal_service import get_technical_signal
        return get_technical_signal(resolve_ticker(ticker))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))