from fastapi import FastAPI 
from pydantic import BaseModel, 

app = FastAPI("backend-name")

@app.get("/")
def home():
    return {
        "message": "Server is running..",
    }

@app.post("/hello?limit=10&name=krishna")
def haha(
    limit: int = 5,
    name: str = "krishna",
    ):
    return {
        "limit": limit,
        "name": name, 
    }

@app.put()

@app.delete()
