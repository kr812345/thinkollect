import os
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Thinkollect Backend")

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    print("Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY not set")
    supabase = None

# Initialize local embedding model
print("Loading embedding model...")
# all-MiniLM-L6-v2 is fast, lightweight, and produces 384-dimensional vectors
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded.")

class WebhookPayload(BaseModel):
    type: str
    table: str
    schema: str
    record: dict
    old_record: dict | None

@app.post("/webhook/embed-thought")
async def embed_thought(payload: dict):
    """
    Webhook endpoint meant to be called by Supabase when a new thought is inserted or updated.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    # Supabase webhooks send a payload with a 'record' object
    record = payload.get("record", {})
    thought_id = record.get("id")
    content = record.get("content")

    if not thought_id or not content:
        raise HTTPException(status_code=400, detail="Missing id or content in record")

    try:
        # Generate embedding
        embedding = model.encode(content).tolist()

        # Update the thought record in Supabase with the new embedding
        response = supabase.table('thoughts').update({'embedding': embedding}).eq('id', thought_id).execute()
        
        return {"status": "success", "message": "Embedding updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Thinkollect API is running"}
