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
        return "High expected demand. Manual staffing and service-capacity review recommended."
    if level == "moderate":
        return "Maintain normal capacity and review the appointment schedule before the service day."
    return "Normal staffing may be sufficient; continue monitoring confirmed appointments."

