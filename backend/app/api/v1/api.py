from fastapi import APIRouter
from app.api.v1.routes import auth, bookings, customer, forecasting, manager, owner, public, transactions

api_router = APIRouter()
api_router.include_router(public.router)
api_router.include_router(auth.router)
api_router.include_router(customer.router)
api_router.include_router(bookings.router)
api_router.include_router(transactions.router)
api_router.include_router(manager.router)
api_router.include_router(owner.router)
api_router.include_router(forecasting.router)
