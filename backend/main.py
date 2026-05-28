from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import Base, engine
from routers import stock, sentiment, signal, auth
import models.user  # ensures tables are registered before create_all

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AlphaLens API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock.router, prefix="/stock", tags=["Stock"])
app.include_router(sentiment.router, prefix="/sentiment", tags=["Sentiment"])
app.include_router(signal.router, prefix="/signal", tags=["Signal"])
app.include_router(auth.router, prefix="/auth", tags=["Auth"])

@app.get("/health")
def health():
    return {"status": "ok"}