import sys
import json
import asyncio

URL_BASE = "http://localhost:3000/api"

async def login(username, password):
    # Si estamos en la web (Pygbag), bloqueamos la petición a localhost
    if sys.platform == "emscripten":
        print("❌ El juego web no puede conectar a localhost. Esperando backend en la nube.")
        return None
        
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{URL_BASE}/login", json={"username": username, "password": password}) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('token')
                return None
    except Exception as e:
        print(f"Error de conexión: {e}")
        return None

async def save_score(token, score):
    if sys.platform == "emscripten": return False
    try:
        import aiohttp
        headers = {"Authorization": f"Bearer {token}"}
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{URL_BASE}/score", json={"score": score}, headers=headers) as response:
                return response.status == 201
    except:
        return False

async def get_leaderboard():
    if sys.platform == "emscripten": return []
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{URL_BASE}/leaderboard") as response:
                if response.status == 200:
                    return await response.json()
                return []
    except:
        return []