import sys
import json
import asyncio

# Tu API real en la nube
URL_BASE = "https://galaga-api.onrender.com/api"

# --- PUENTE INTELIGENTE DE RED ---
async def make_request(endpoint, method="GET", payload=None, token=None):
    url = f"{URL_BASE}{endpoint}"
    
    if sys.platform != "emscripten":
        # MODO ESCRITORIO: Usa la librería nativa de Python
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
        # MODO WEB: Puente directo a la API fetch de JavaScript vía WebAssembly
        import platform
        import time
        req_id = str(int(time.time() * 1000))
        
        auth_header = f", 'Authorization': 'Bearer {token}'" if token else ""
        
        # Inyectamos Javascript asíncrono directamente al navegador
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
        
        # Le damos respiro al navegador mientras esperamos la respuesta de Render
        while getattr(platform.window, f"status_{req_id}") == 0:
            await asyncio.sleep(0.1)
            
        status = int(getattr(platform.window, f"status_{req_id}"))
        res_text = getattr(platform.window, f"res_{req_id}")
        
        try:
            data = json.loads(res_text) if res_text and res_text != 'Error' else None
        except:
            data = None
            
        return status, data

# --- LÓGICA DEL JUEGO CONECTADA A LA NUBE ---
async def login(username, password):
    print(f"📡 Conectando con Render para autenticar a {username}...")
    status, data = await make_request("/login", "POST", payload={"username": username, "password": password})
    if status == 200 and data:
        print("✅ Acceso validado en la nube.")
        return data.get("token")
    print("❌ Credenciales inválidas.")
    return None

async def save_score(token, score):
    status, _ = await make_request("/score", "POST", payload={"score": score}, token=token)
    if status == 201:
        print("✅ Puntuación registrada exitosamente en TiDB.")
        return True
    return False

async def get_leaderboard():
    status, data = await make_request("/leaderboard", "GET")
    if status == 200 and data:
        return data
    return []