from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from core.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WatchlistItem(Base):
    __tablename__ = "watchlist"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

class SimulatedTrade(Base):
    __tablename__ = "simulated_trades"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String)
    action = Column(String)  
    quantity = Column(Integer)
    price = Column(Float)
    slippage = Column(Float)
    fees = Column(Float)
    total_cost = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class VirtualPortfolio(Base):
    __tablename__ = "virtual_portfolio"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    balance = Column(Float, default=100000.0)  # ₹1,00,000 starting balance
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String)
    quantity = Column(Integer)
    avg_buy_price = Column(Float)
    added_at = Column(DateTime(timezone=True), server_default=func.now())