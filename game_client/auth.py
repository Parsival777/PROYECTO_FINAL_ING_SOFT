import aiohttp
import asyncio

# Por ahora usamos localhost. Cuando subamos tu API a Render, solo cambiaremos esta URL.
URL_BASE = "http://localhost:3000/api"

REGISTER_URL = f"{URL_BASE}/register"
LOGIN_URL = f"{URL_BASE}/login"
SCORE_URL = f"{URL_BASE}/score"
LEADERBOARD_URL = f"{URL_BASE}/leaderboard"

async def login(username, password):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(LOGIN_URL, json={"username": username, "password": password}) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('token')
                else:
                    error_data = await response.json()
                    print(f"Error al iniciar sesión: {error_data.get('error')}")
                    return None
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return None

async def register(username, password):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(REGISTER_URL, json={"username": username, "password": password}) as response:
                if response.status == 201:
                    print("✅ Usuario registrado exitosamente.")
                    return True
                else:
                    error_data = await response.json()
                    print(f"Error al registrar: {error_data.get('error')}")
                    return False
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        return False

async def save_score(token, score):
    try:
        headers = {"Authorization": f"Bearer {token}"}
        async with aiohttp.ClientSession() as session:
            async with session.post(SCORE_URL, json={"score": score}, headers=headers) as response:
                return response.status == 201
    except:
        return False

async def get_leaderboard():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(LEADERBOARD_URL) as response:
                if response.status == 200:
                    return await response.json()
                return []
    except:
        return []