from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn
from typing import Optional
import asyncio

app = FastAPI()

last_scanned_url: Optional[str] = None
url_lock = asyncio.Lock()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.get("/code", response_class=HTMLResponse)
async def read_code():
    try:
        with open("code.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Файл code.html не найден</h1>", status_code=404)

@app.post("/api/qr-link")
async def receive_qr_link(data: dict):
    global last_scanned_url
    qr_url = data.get('qr_url')
    
    async with url_lock:
        last_scanned_url = qr_url    
    return {"status": "success", "message": "URL получен"}


@app.get("/api/last-url")
async def get_last_url():
    return {
        "url": last_scanned_url,
        "timestamp": "Только что" if last_scanned_url else None
    }

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=4433,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem",
    )