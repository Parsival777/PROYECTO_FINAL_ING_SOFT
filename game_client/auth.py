import sys

# ¡Aquí está tu nueva API en la nube!
URL_BASE = "https://galaga-api.onrender.com/api"

async def login(username, password):
    # El modo web se mantiene simulado para evitar bloqueos de seguridad (CORS) del navegador en la presentación
    if sys.platform == "emscripten":
        print("🌐 Modo Web: Acceso offline concedido.")
        return "token_simulado_web"
        
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{URL_BASE}/login", json={"username": username, "password": password}) as response:
                if response.status == 200:
                    data = await response.json()
                    print("✅ Conectado a Render y TiDB exitosamente.")
                    return data.get('token')
                return None
    except Exception as e:
        print(f"Error de conexión: {e}")
        return None

async def save_score(token, score):
    if sys.platform == "emscripten":
        print(f"🌐 Modo Web: Puntuación de {score} guardada en memoria.")
        return True
    try:
        import aiohttp
        headers = {"Authorization": f"Bearer {token}"}
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{URL_BASE}/score", json={"score": score}, headers=headers) as response:
                return response.status == 201
    except:
        return False

async def get_leaderboard():
    if sys.platform == "emscripten":
        return [{"username": "PilotoWeb", "score": 9999}]
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{URL_BASE}/leaderboard") as response:
                if response.status == 200:
                    return await response.json()
                return []
    except:
        return []