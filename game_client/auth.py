import requests

API_URL = "http://localhost:3000"

def login(username, password):
    print(f"Intentando iniciar sesión como '{username}'...")
    try:
        response = requests.post(f"{API_URL}/login", json={
            "username": username,
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            print("¡Login exitoso!")
            print(f"Token JWT recibido: {data['token'][:30]}...") # Imprimimos un pedacito del token
            return data['token']
        else:
            print(f" Error al iniciar sesión: {response.json().get('error')}")
            return None
    except requests.exceptions.ConnectionError:
        print(" Error: No se pudo conectar a la API. ¿Está encendido el servidor Node.js?")
        return None

# Prueba rápida
if __name__ == "__main__":
    login("pilot_galaga", "password123")