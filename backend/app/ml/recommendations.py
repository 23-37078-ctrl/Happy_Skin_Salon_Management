from __future__ import annotations


def demand_level(predicted: float, recent_daily_average: float) -> str:
    reference = max(recent_daily_average, 1.0)
    if predicted >= reference * 1.5 and predicted >= 3:
        return "high"
    if predicted >= reference * 0.75 and predicted >= 1:
        return "moderate"
    return "low"


def recommendation_for(level: str, capacity_available: bool = False) -> str:
    if level == "high":
        return "This may be a busy day. Check staff availability and prepare supplies for the appointments booked."
    if level == "moderate":
        return "Plan for a usual day and check the appointment list before opening."
    return "This may be a quieter day. Keep your usual team plan and check for new bookings."

