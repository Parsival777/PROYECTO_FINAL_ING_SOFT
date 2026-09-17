import sys

URL_BASE = "http://localhost:3000/api"

async def login(username, password):
    # En la web, simulamos el login para que puedas entrar y jugar
    if sys.platform == "emscripten":
        print("🌐 Modo Web: Acceso offline concedido.")
        return "token_simulado_web"
    
    print("❌ El backend local requiere peticiones asíncronas configuradas.")
    return None

async def save_score(token, score):
    if sys.platform == "emscripten":
        print(f"🌐 Modo Web: Puntuación de {score} en memoria.")
        return True
    return False

async def get_leaderboard():
    if sys.platform == "emscripten":
        return [{"username": "PilotoWeb", "score": 9999}]
    return []