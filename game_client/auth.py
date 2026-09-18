import sys
import json
import asyncio

URL_BASE = "https://galaga-api.onrender.com/api"

async def make_request(endpoint, method="GET", payload=None, token=None):
    url = f"{URL_BASE}{endpoint}"
    
    if sys.platform != "emscripten":
        import aiohttp
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            async with aiohttp.ClientSession() as session:
                if method == "POST":
                    async with session.post(url, json=payload, headers=headers) as response:
                        text = await response.text()
                        return response.status, json.loads(text) if text else None
                else:
                    async with session.get(url, headers=headers) as response:
                        text = await response.text()
                        return response.status, json.loads(text) if text else None
        except Exception as e:
            print(f"Error local: {e}")
            return 500, None
    else:
        import platform
        import time
        req_id = str(int(time.time() * 1000))
        
        auth_header = f", 'Authorization': 'Bearer {token}'" if token else ""
        
        js_code = f"""
        window.res_{req_id} = null;
        window.status_{req_id} = 0;
        fetch('{url}', {{
            method: '{method}',
            headers: {{ 'Content-Type': 'application/json'{auth_header} }},
            body: { 'JSON.stringify(' + json.dumps(payload) + ')' if payload else 'null' }
        }})
        .then(r => {{ window.status_{req_id} = r.status; return r.text(); }})
        .then(t => window.res_{req_id} = t)
        .catch(e => {{ window.status_{req_id} = 500; window.res_{req_id} = 'Error'; }});
        """
        
        platform.window.eval(js_code)
        
        while getattr(platform.window, f"status_{req_id}") == 0:
            await asyncio.sleep(0.1)
            
        status = int(getattr(platform.window, f"status_{req_id}"))
        res_text = getattr(platform.window, f"res_{req_id}")
        
        try:
            data = json.loads(res_text) if res_text and res_text != 'Error' else None
        except:
            data = None
            
        return status, data

async def register(username, password):
    if sys.platform == "emscripten":
        return True, "Registro exitoso (Modo Web)"
    status, data = await make_request("/register", "POST", payload={"username": username, "password": password})
    if status == 201: return True, "Cuenta creada. Presiona TAB para Login."
    elif status == 400: return False, "El usuario ya existe."
    return False, "Error en el servidor."

async def login(username, password):
    if sys.platform == "emscripten":
        return "token_simulado_web"
    status, data = await make_request("/login", "POST", payload={"username": username, "password": password})
    if status == 200 and data: return data.get("token")
    return None

async def save_score(token, score):
    if sys.platform == "emscripten": return True
    status, _ = await make_request("/score", "POST", payload={"score": score}, token=token)
    return status == 201

async def get_leaderboard():
    if sys.platform == "emscripten":
        return [{"username": "PilotoWeb", "score": 9999}]
    status, data = await make_request("/leaderboard", "GET")
    if status == 200 and data: return data
    return []

async def get_profile(token):
    if sys.platform == "emscripten":
        return {"username": "Invitado", "coins": 9999, "current_skin": "player_default", "owned_skins": "player_default"}
    status, data = await make_request("/me", "GET", token=token)
    if status == 200 and data:
        return data
    return {"coins": 0, "current_skin": "player_default", "owned_skins": "player_default"}

async def buy_skin(token, skin_name, cost):
    if sys.platform == "emscripten":
        return True, "Equipado (Modo Web)"
    status, data = await make_request("/shop", "POST", payload={"skin_name": skin_name, "cost": cost}, token=token)
    if status == 200:
        return True, data.get("message", "Skin equipada.")
    elif data and "error" in data:
        return False, data["error"]
    return False, "Error en transacción."

async def equip_skin(token, skin_name):
    if sys.platform == "emscripten":
        return True, "Equipado (Modo Web)"
    status, data = await make_request("/equip", "POST", payload={"skin_name": skin_name}, token=token)
    if status == 200:
        return True, "Skin equipada."
    elif data and "error" in data:
        return False, data["error"]
    return False, "Error al equipar."