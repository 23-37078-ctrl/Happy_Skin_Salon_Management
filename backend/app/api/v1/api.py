from fastapi import APIRouter
from app.api.v1.routes import auth, customer, customer_support, forecasting, health, manager, owner, owner_customers, public, transactions

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(public.router)
api_router.include_router(auth.router)
api_router.include_router(customer.router)
api_router.include_router(customer_support.customer_router)
api_router.include_router(customer_support.owner_router)
api_router.include_router(owner_customers.router)
api_router.include_router(transactions.router)
api_router.include_router(manager.router)
api_router.include_router(owner.router)
api_router.include_router(forecasting.router)
