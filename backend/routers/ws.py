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
            data = {
                "ticker": resolved,
                "price": round(info.last_price, 2) if info.last_price else None,
                "volume": info.last_volume if info.last_volume else None,
            }
            await websocket.send_text(json.dumps(data))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        print(f"Client disconnected from {resolved}")