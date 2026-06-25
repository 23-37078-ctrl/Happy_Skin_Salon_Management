from fastapi import APIRouter
from app.api.v1.routes import auth, customer, bookings, transactions

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(customer.router)
api_router.include_router(bookings.router)
api_router.include_router(transactions.router)