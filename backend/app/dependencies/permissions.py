from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import User


def require_role(*allowed_roles: str):
    """
    Returns a FastAPI dependency that ensures the current user's role
    is one of the allowed roles. Usage:

        @router.get("/staff-only")
        def endpoint(user: User = Depends(require_role("staff"))):
            ...

        @router.get("/staff-or-manager")
        def endpoint(user: User = Depends(require_role("staff", "manager"))):
            ...
    """

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {', '.join(allowed_roles)}.",
            )
        return current_user

    return role_checker


def require_staff_branch(current_user: User = Depends(require_role("staff"))) -> User:
    """
    Ensures the current user is staff AND has a branch assigned.
    Staff accounts without a branch_id are mis-configured and should
    not be able to access branch-scoped operations.
    """
    if current_user.branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your staff account is not assigned to a branch. Please contact your manager.",
        )
    return current_user


def require_manager_branch(current_user: User = Depends(require_role("manager"))) -> User:
    """
    Ensures the current user is a manager with one assigned branch.
    Manager endpoints must always scope branch data from this value.
    """
    if current_user.branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your manager account is not assigned to a branch. Please contact the owner.",
        )
    return current_user
