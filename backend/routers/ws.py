import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import yfinance as yf
from routers.stock import resolve_ticker

router = APIRouter()

@router.websocket("/live/{ticker}")
async def live_price(websocket: WebSocket, ticker: str):
    await websocket.accept()
    resolved = resolve_ticker(ticker)
    try:
        while True:
            t = yf.Ticker(resolved)
            info = t.fast_info
            price = float(info.last_price) if info.last_price else None
            prev_close = float(info.previous_close) if info.previous_close else None
            change_pct = round((price - prev_close) / prev_close * 100, 2) if price and prev_close else None
            data = {
                "ticker": resolved,
                "price": round(price, 2) if price else None,
                "volume": info.last_volume if info.last_volume else None,
                "change_pct": change_pct,
            }
            await websocket.send_text(json.dumps(data))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        print(f"Client disconnected from {resolved}")