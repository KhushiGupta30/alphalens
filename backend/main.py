from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import Base, engine
import models.user  
from routers import stock, sentiment, signal, auth, ws, paper_trade, portfolio, watchlist





Base.metadata.create_all(bind=engine)

app = FastAPI(title="AlphaLens API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://alphalens-sand.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock.router, prefix="/stock", tags=["Stock"])
app.include_router(sentiment.router, prefix="/sentiment", tags=["Sentiment"])
app.include_router(signal.router, prefix="/signal", tags=["Signal"])
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(ws.router, prefix="/ws", tags=["WebSocket"])
app.include_router(paper_trade.router, prefix="/paper", tags=["Paper Trading"])

app.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])
app.include_router(watchlist.router, prefix="/watchlist", tags=["Watchlist"])

@app.get("/health")
def health():
    return {"status": "ok"}