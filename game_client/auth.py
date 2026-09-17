import requests

REGISTER_URL = "http://localhost:3000/api/register"
LOGIN_URL = "http://localhost:3000/api/login"
SCORE_URL = "http://localhost:3000/api/score"
LEADERBOARD_URL = "http://localhost:3000/api/leaderboard"

def login(username, password):
    try:
        response = requests.post(LOGIN_URL, json={"username": username, "password": password})
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"Error al iniciar sesión: {response.json().get('error')}")
            return None
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se pudo conectar al servidor. ¿Está encendido el api_server?")
        return None
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return None

def register(username, password):
    try:
        response = requests.post(REGISTER_URL, json={"username": username, "password": password})
        if response.status_code == 201:
            print("✅ Usuario registrado exitosamente.")
            return True
        else:
            print(f"Error al registrar: {response.json().get('error')}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se pudo conectar al servidor. ¿Está encendido el api_server?")
        return False
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return False

def save_score(token, score):
    try:
        # Enviamos el token en los headers para que el middleware del backend nos deje pasar
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(SCORE_URL, json={"score": score}, headers=headers)
        return response.status_code == 201
    except:
        return False

def get_leaderboard():
    try:
        response = requests.get(LEADERBOARD_URL)
        if response.status_code == 200:
            return response.json()
        return []
    except:
        return []