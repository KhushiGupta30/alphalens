from fastapi import APIRouter
router = APIRouter()

@router.post("/register")
def register():
    return {"status": "coming soon"}

@router.post("/login")
def login():
    return {"status": "coming soon"}