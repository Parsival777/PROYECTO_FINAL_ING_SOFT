import pygame
import sys
import random
import os
import math
import asyncio
import auth

# --- Configuración Básica ---
WIDTH, HEIGHT = 800, 600
FPS = 60

# --- Colores ---
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 50, 50)
LIGHT_GREY = (200, 200, 200)
BLUE_INACTIVE = pygame.Color('lightskyblue3')
BLUE_ACTIVE = pygame.Color('dodgerblue2')
RARITY_COLORS = {"common": (150, 150, 150), "epic": (163, 53, 238), "legendary": (255, 128, 0)}

# --- Fondo Animado (Starfield) ---
NUM_STARS = 100
stars = []
for i in range(NUM_STARS):
    x = random.randrange(0, WIDTH)
    y = random.randrange(0, HEIGHT)
    speed = random.randrange(1, 5)
    size = random.randrange(1, 3)
    stars.append([x, y, speed, size])

# Inicializamos Pygame
pygame.mixer.init()
pygame.init()
font_name = pygame.font.match_font('arial')

player_img = mini_player_img = laser_img = blue_img = red_img = green_img = None
shoot_sound = expl_sound = None
music_loaded = False
assets = {}

def load_assets():
    global player_img, mini_player_img, laser_img, blue_img, red_img, green_img
    global shoot_sound, expl_sound, music_loaded, assets
    img_dir = os.path.join(os.path.dirname(__file__), 'img')
    snd_dir = os.path.join(os.path.dirname(__file__), 'snd')
    
    def get_img(name, size, fallback_color):
        try:
            return pygame.transform.scale(pygame.image.load(os.path.join(img_dir, name)).convert_alpha(), size)
        except:
            s = pygame.Surface(size, pygame.SRCALPHA)
            s.fill(fallback_color)
            return s
    
    # Nuevas imágenes (Corazón y Skins extras)
    assets['heart'] = get_img('heart.png', (25, 25), RED)
    assets['skin_stealth'] = get_img('skin_stealth.png', (40, 40), (100, 100, 100))
    assets['skin_neon'] = get_img('skin_neon.png', (40, 40), (0, 255, 255))
    assets['player_default'] = get_img('main_ship.png', (40, 40), (150, 150, 150))
    
    player_img = assets['player_default']
    mini_player_img = pygame.transform.scale(player_img, (25, 25))
    laser_img = get_img('laser.png', (25, 40), (255, 255, 0))
    blue_img = get_img('blue_ship.png', (40, 40), (0, 0, 255))
    red_img = get_img('red_ship.png', (40, 40), (255, 0, 0))
    green_img = get_img('green_ship.png', (40, 40), (0, 255, 0))

    try:
        shoot_sound = pygame.mixer.Sound(os.path.join(snd_dir, 'laser.wav'))
        shoot_sound.set_volume(0.3)
        expl_sound = pygame.mixer.Sound(os.path.join(snd_dir, 'explosion.wav'))
        expl_sound.set_volume(0.4)
    except FileNotFoundError:
        shoot_sound = expl_sound = None

    try:
        pygame.mixer.music.load(os.path.join(snd_dir, 'musica.ogg'))
        pygame.mixer.music.set_volume(0.5)
        music_loaded = True
    except Exception as e:
        music_loaded = False

def draw_text(surf, text, size, x, y, align="midtop", color=WHITE):
    font = pygame.font.Font(font_name, size)
    text_surface = font.render(text, True, color)
    text_rect = text_surface.get_rect()
    if align == "midtop":
        text_rect.midtop = (x, y)
    elif align == "topright":
        text_rect.topright = (x, y)
    elif align == "center":
        text_rect.center = (x, y)
    surf.blit(text_surface, text_rect)

def draw_lives(surf, x, y, lives):
    for i in range(lives):
        rect = assets['heart'].get_rect()
        rect.x = x + 30 * i
        rect.y = y
        surf.blit(assets['heart'], rect)

# --- BASE DE DATOS DE SKINS ---
CATALOGO = [
    {"id": "player_default", "name": "Nave Base", "price": 0, "rarity": "common"},
    {"id": "skin_stealth", "name": "Caza Furtivo", "price": 1500, "rarity": "epic"},
    {"id": "skin_neon", "name": "Neón Cósmico", "price": 3000, "rarity": "legendary"}
]

def draw_card(screen, item, x, y, status, highlight=False):
    rect = pygame.Rect(x, y, 160, 220)
    color = RARITY_COLORS[item["rarity"]]
    pygame.draw.rect(screen, (30, 30, 40), rect)
    pygame.draw.rect(screen, color if not highlight else WHITE, rect, 3 if not highlight else 5)
    
    img = pygame.transform.scale(assets[item["id"]], (80, 80))
    screen.blit(img, (x + 40, y + 30))
    
    draw_text(screen, item["name"], 18, x + 80, y + 130, align="center", color=color)
    draw_text(screen, status, 18, x + 80, y + 170, align="center", color=WHITE)


# --- CLASE PARA CAJAS DE TEXTO ---
class InputBox:
    def __init__(self, x, y, w, h, text='', is_password=False):
        self.rect = pygame.Rect(x, y, w, h)
        self.color = BLUE_INACTIVE
        self.text = text
        self.font = pygame.font.Font(font_name, 24)
        self.txt_surface = self.font.render(text, True, self.color)
        self.active = False
        self.is_password = is_password

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.active = not self.active
            else:
                self.active = False
            self.color = BLUE_ACTIVE if self.active else BLUE_INACTIVE
            
        if event.type == pygame.KEYDOWN:
            if self.active:
                if event.key == pygame.K_RETURN:
                    return self.text
                elif event.key == pygame.K_BACKSPACE:
                    self.text = self.text[:-1]
                elif event.key not in [pygame.K_TAB, pygame.K_ESCAPE]:
                    self.text += event.unicode
                
                display_text = '*' * len(self.text) if self.is_password else self.text
                self.txt_surface = self.font.render(display_text, True, WHITE)
        return None

    def update(self):
        width = max(200, self.txt_surface.get_width() + 10)
        self.rect.w = width

    def draw(self, screen):
        screen.blit(self.txt_surface, (self.rect.x + 5, self.rect.y + 5))
        pygame.draw.rect(screen, self.color, self.rect, 2)

# --- PANTALLAS DE INTERFAZ ---

async def login_screen(screen, clock):
    input_box1 = InputBox(WIDTH // 2 - 100, HEIGHT // 2 - 40, 200, 32)
    input_box2 = InputBox(WIDTH // 2 - 100, HEIGHT // 2 + 20, 200, 32, is_password=True)
    input_boxes = [input_box1, input_box2]
    error_msg = ""
    estado = "LOGIN"
    
    while True:
        screen.fill(BLACK)
        for star in stars:
            star[1] += star[2] 
            if star[1] > HEIGHT:
                star[1] = random.randrange(-20, -5)
                star[0] = random.randrange(0, WIDTH)
            pygame.draw.rect(screen, LIGHT_GREY, (star[0], star[1], star[3], star[3]))

        draw_text(screen, f"🛸 GALAGA - MODO {estado} 🛸", 32, WIDTH // 2, HEIGHT // 4 - 50)
        draw_text(screen, "Usuario:", 22, WIDTH // 2 - 110, HEIGHT // 2 - 35, align="topright")
        draw_text(screen, "Clave:", 22, WIDTH // 2 - 110, HEIGHT // 2 + 25, align="topright")
        draw_text(screen, "ENTER: Aceptar | TAB: Cambiar Modo | ESC: Invitado", 18, WIDTH // 2, HEIGHT // 2 + 80, color=(100, 255, 100))
        
        if error_msg:
            draw_text(screen, error_msg, 18, WIDTH // 2, HEIGHT // 2 + 115, color=RED if "❌" in error_msg else WHITE)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
                
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_TAB:
                    estado = "REGISTRO" if estado == "LOGIN" else "LOGIN"
                    error_msg = f"Modo {estado} activado."
                elif event.key == pygame.K_ESCAPE:
                    return None, "Invitado"
            
            for box in input_boxes:
                box.handle_event(event)
            
            if event.type == pygame.KEYDOWN and event.key == pygame.K_RETURN:
                if input_box1.text and input_box2.text:
                    if estado == "LOGIN":
                        error_msg = "Conectando..."
                        draw_text(screen, error_msg, 18, WIDTH // 2, HEIGHT // 2 + 115, color=WHITE)
                        pygame.display.flip()
                        
                        token = await auth.login(input_box1.text, input_box2.text)
                        if token:
                            return token, input_box1.text
                        else:
                            error_msg = "❌ Credenciales inválidas o error."
                            input_box2.text = "" 
                            input_box2.txt_surface = input_box2.font.render("", True, WHITE)
                    else:
                        error_msg = "Registrando en la nube..."
                        draw_text(screen, error_msg, 18, WIDTH // 2, HEIGHT // 2 + 115, color=WHITE)
                        pygame.display.flip()
                        
                        exito, msg = await auth.register(input_box1.text, input_box2.text)
                        error_msg = msg
                        if exito:
                            estado = "LOGIN"
                            input_box2.text = ""
                            input_box2.txt_surface = input_box2.font.render("", True, WHITE)

        for box in input_boxes:
            box.update()
            box.draw(screen)

        pygame.display.flip()
        clock.tick(FPS)
        await asyncio.sleep(0) 

async def shop_and_locker(screen, clock, token, coins, owned_skins, current_skin, mode="SHOP"):
    waiting, msg = True, ""
    while waiting:
        screen.fill(BLACK)
        for star in stars:
            star[1] += star[2]
            if star[1] > HEIGHT:
                star[1] = random.randrange(-20, -5)
                star[0] = random.randrange(0, WIDTH)
            pygame.draw.rect(screen, LIGHT_GREY, (star[0], star[1], star[3], star[3]))
            
        draw_text(screen, "🏪 TIENDA DE ITEMS 🏪" if mode == "SHOP" else "🗄️ TU LOCKER 🗄️", 36, WIDTH // 2, 50, color=BLUE_ACTIVE)
        draw_text(screen, f"Billetera: {coins} 🪙", 24, WIDTH // 2, 100, color=(255, 215, 0))
        
        spacing = (WIDTH - (len(CATALOGO) * 160)) // (len(CATALOGO) + 1)
        
        for i, item in enumerate(CATALOGO):
            x = spacing + (i * (160 + spacing))
            y = 180
            
            if mode == "SHOP":
                status = "COMPRADO" if item["id"] in owned_skins else f"{item['price']} 🪙"
            else:
                if item["id"] == current_skin: status = "EQUIPADO"
                elif item["id"] in owned_skins: status = "DISPONIBLE"
                else: status = "BLOQUEADO"
                
            draw_card(screen, item, x, y, status, highlight=(item["id"] == current_skin))
            draw_text(screen, f"[{i+1}]", 20, x + 80, y + 420, align="center")

        draw_text(screen, f"Presiona 1, 2 o 3 para {'Comprar' if mode == 'SHOP' else 'Equipar'}", 20, WIDTH // 2, 450)
        draw_text(screen, "[ TAB ] Cambiar entre Tienda/Locker  |  [ ESC ] Volver al Lobby", 18, WIDTH // 2, 500, color=LIGHT_GREY)
        if msg: draw_text(screen, msg, 20, WIDTH // 2, 550, color=(255, 255, 0))

        pygame.display.flip()
        clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT: sys.exit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE: return coins, current_skin, owned_skins
                if event.key == pygame.K_TAB: mode = "LOCKER" if mode == "SHOP" else "SHOP"; msg = ""
                
                if event.key in [pygame.K_1, pygame.K_2, pygame.K_3]:
                    idx = event.key - pygame.K_1
                    if idx < len(CATALOGO):
                        selected = CATALOGO[idx]
                        if mode == "SHOP":
                            if selected["id"] in owned_skins: msg = "Ya tienes esta skin."
                            else:
                                success, text = await auth.buy_skin(token, selected["id"], selected["price"])
                                msg = text
                                if success:
                                    coins -= selected["price"]
                                    owned_skins.append(selected["id"])
                                    current_skin = selected["id"]
                        elif mode == "LOCKER":
                            if selected["id"] in owned_skins:
                                success, text = await auth.equip_skin(token, selected["id"])
                                msg = text
                                if success: current_skin = selected["id"]
                            else: msg = "Debes comprarla en la tienda primero."
        await asyncio.sleep(0)

async def lobby_screen(screen, clock, user, coins, current_skin):
    waiting = True
    while waiting:
        screen.fill(BLACK)
        for star in stars:
            star[1] += star[2]
            if star[1] > HEIGHT:
                star[1] = random.randrange(-20, -5)
                star[0] = random.randrange(0, WIDTH)
            pygame.draw.rect(screen, LIGHT_GREY, (star[0], star[1], star[3], star[3]))

        draw_text(screen, "🛸 LOBBY DE PILOTOS 🛸", 40, WIDTH // 2, HEIGHT // 4 - 50, color=BLUE_ACTIVE)
        draw_text(screen, f"Piloto: {user}", 24, WIDTH // 2, HEIGHT // 2 - 60)
        draw_text(screen, f"Billetera: {coins} 🪙", 24, WIDTH // 2, HEIGHT // 2 - 20, color=(255, 215, 0))
        
        skin_name = next((s["name"] for s in CATALOGO if s["id"] == current_skin), "Desconocida")
        draw_text(screen, f"Nave Actual: {skin_name}", 20, WIDTH // 2, HEIGHT // 2 + 15, color=LIGHT_GREY)

        draw_text(screen, "[ ENTER ] Iniciar Misión", 24, WIDTH // 2, HEIGHT // 2 + 90, color=(100, 255, 100))
        draw_text(screen, "[ T ] Tienda / Locker", 24, WIDTH // 2, HEIGHT // 2 + 130, color=(163, 53, 238))
        draw_text(screen, "[ ESC ] Cerrar Sesión", 20, WIDTH // 2, HEIGHT // 2 + 190, color=RED)

        pygame.display.flip()
        clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN: return "PLAY"
                if event.key == pygame.K_t: return "SHOP_LOCKER"
                if event.key == pygame.K_ESCAPE: return "LOGOUT"
        await asyncio.sleep(0)

async def show_go_screen(screen, score, token):
    screen.fill(BLACK)
    draw_text(screen, "GAME OVER", 64, WIDTH // 2, HEIGHT // 4)
    draw_text(screen, f"Puntuación: {score}", 22, WIDTH // 2, HEIGHT // 2)
    
    if token and score > 0:
        # Ganancia dinámica: 10 pts = 1 moneda
        draw_text(screen, f"Monedas ganadas: {math.floor(score / 10)} 🪙", 22, WIDTH // 2, HEIGHT // 2 + 40, color=(255, 215, 0))
        draw_text(screen, "Guardando en TiDB Cloud...", 18, WIDTH // 2, HEIGHT * 3 // 4)
        pygame.display.flip()
        await auth.save_score(token, score)
    elif not token:
        draw_text(screen, "Modo Invitado: Puntos/Monedas no registradas.", 18, WIDTH // 2, HEIGHT * 3 // 4, color=RED)
        pygame.display.flip()
        await asyncio.sleep(1)
    
    leaderboard = await auth.get_leaderboard()
    
    screen.fill(BLACK)
    draw_text(screen, "GAME OVER", 50, WIDTH // 2, HEIGHT // 8)
    draw_text(screen, f"Tu Puntuación: {score}", 24, WIDTH // 2, HEIGHT // 8 + 60)
    
    draw_text(screen, "--- TOP PILOTOS ---", 22, WIDTH // 2, HEIGHT // 2 - 40)
    y_offset = HEIGHT // 2 
    for i, p in enumerate(leaderboard[:5]):
        texto = f"{i+1}. {p['username']} - {p['score']} pts"
        draw_text(screen, texto, 20, WIDTH // 2, y_offset)
        y_offset += 30
        
    draw_text(screen, "Presiona ESPACIO para regresar al Lobby", 18, WIDTH // 2, HEIGHT - 50)
    pygame.display.flip()
    
    waiting = True
    while waiting:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYUP and event.key == pygame.K_SPACE:
                waiting = False
        await asyncio.sleep(0) 

# --- CLASES DEL JUEGO INTACTAS ---
class Player(pygame.sprite.Sprite):
    def __init__(self, all_sprites, bullets, skin_img):
        super().__init__()
        self.image = skin_img 
        self.rect = self.image.get_rect()
        self.rect.centerx = WIDTH // 2
        self.rect.bottom = HEIGHT - 20
        self.speedx = 0
        self.all_sprites = all_sprites
        self.bullets = bullets
        self.shoot_delay = 250
        self.last_shot = pygame.time.get_ticks()
        self.lives = 3
        self.hidden = False
        self.hide_timer = pygame.time.get_ticks()

    def update(self):
        if self.hidden and pygame.time.get_ticks() - self.hide_timer > 1500:
            self.hidden = False
            self.rect.centerx = WIDTH // 2
            self.rect.bottom = HEIGHT - 20

        self.speedx = 0
        keystate = pygame.key.get_pressed()
        if not self.hidden:
            if keystate[pygame.K_LEFT]: self.speedx = -6 
            if keystate[pygame.K_RIGHT]: self.speedx = 6
            if keystate[pygame.K_SPACE]: self.shoot()
                
        self.rect.x += self.speedx
        if self.rect.right > WIDTH: self.rect.right = WIDTH
        if self.rect.left < 0: self.rect.left = 0

    def shoot(self):
        now = pygame.time.get_ticks()
        if now - self.last_shot > self.shoot_delay:
            self.last_shot = now
            bullet = Bullet(self.rect.centerx, self.rect.top)
            self.all_sprites.add(bullet)
            self.bullets.add(bullet)
            if shoot_sound: shoot_sound.play()
            
    def hide(self):
        self.hidden = True
        self.hide_timer = pygame.time.get_ticks()
        self.rect.center = (WIDTH / 2, HEIGHT + 200)

class Bullet(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = laser_img
        self.rect = self.image.get_rect()
        self.rect.bottom = y
        self.rect.centerx = x
        self.speedy = -12 
    def update(self):
        self.rect.y += self.speedy
        if self.rect.bottom < 0: self.kill()

class EnemyBullet(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = pygame.Surface((6, 15))
        self.image.fill(RED)
        self.rect = self.image.get_rect()
        self.rect.top = y
        self.rect.centerx = x
        self.speedy = 4 
    def update(self):
        self.rect.y += self.speedy
        if self.rect.top > HEIGHT: self.kill()

class Enemy(pygame.sprite.Sprite):
    def __init__(self, all_sprites, enemy_bullets, col, row):
        super().__init__()
        self.all_sprites = all_sprites
        self.enemy_bullets = enemy_bullets
        self.col = col
        self.row = row
        self.target_x = 120 + (col * 80)
        self.target_y = 60 + (row * 60)
        
        if row == 0:
            self.tipo = 'jefe'
            self.image = green_img.copy()
            self.hp = 2
            self.points = 150
            self.dive_speed = random.uniform(1.6, 2.4) 
            self.curve_width = 40
            self.dive_prob = 0.0005 
            self.pos_x = float(self.target_x)
            self.pos_y = float(-100)
        elif row == 1:
            self.tipo = 'mariposa'
            self.image = red_img.copy()
            self.hp = 1
            self.points = 80
            self.dive_speed = random.uniform(1.8, 2.3) 
            self.curve_width = 60
            self.dive_prob = 0.002 
            self.pos_x = float(-100)
            self.pos_y = float(random.randint(0, HEIGHT // 3))
        else:
            self.tipo = 'abeja'
            self.image = blue_img.copy()
            self.hp = 1
            self.points = 50
            self.dive_speed = random.uniform(2.3, 3.0) 
            self.curve_width = 80
            self.dive_prob = 0.0035 
            self.pos_x = float(WIDTH + 100)
            self.pos_y = float(random.randint(0, HEIGHT // 3))

        self.rect = self.image.get_rect()
        self.rect.centerx = int(self.pos_x)
        self.rect.centery = int(self.pos_y)
        self.state = 'entering'
        self.start_dive_x = 0

    def update(self):
        if self.state == 'entering':
            self.pos_x += (self.target_x - self.pos_x) * 0.03 
            self.pos_y += (self.target_y - self.pos_y) * 0.03
            self.rect.centerx = int(self.pos_x)
            self.rect.centery = int(self.pos_y)
            if abs(self.target_x - self.pos_x) < 2 and abs(self.target_y - self.pos_y) < 2:
                self.state = 'formation'
        elif self.state == 'formation':
            self.rect.centerx = int(self.target_x + math.sin(pygame.time.get_ticks() / 500.0) * 20)
            self.rect.centery = int(self.target_y + math.cos(pygame.time.get_ticks() / 500.0) * 10)
            if random.random() < self.dive_prob:
                self.state = 'diving'
                self.start_dive_x = self.rect.centerx
                self.pos_x = float(self.rect.centerx)
                self.pos_y = float(self.rect.y)
            if self.tipo == 'jefe' and random.random() < 0.002:
                self.shoot()
        elif self.state == 'diving':
            self.pos_y += self.dive_speed
            self.rect.y = int(self.pos_y)
            self.rect.centerx = int(self.start_dive_x + math.sin(self.rect.y / 50.0) * self.curve_width)
            if self.tipo == 'jefe' and random.random() < 0.01:
                self.shoot()
            if self.rect.top > HEIGHT:
                self.state = 'entering'
                if self.tipo == 'jefe': self.pos_x, self.pos_y = float(self.target_x), float(-100)
                elif self.tipo == 'mariposa': self.pos_x, self.pos_y = float(-100), float(random.randint(0, HEIGHT // 3))
                else: self.pos_x, self.pos_y = float(WIDTH + 100), float(random.randint(0, HEIGHT // 3))
                
    def shoot(self):
        bullet = EnemyBullet(self.rect.centerx, self.rect.bottom)
        self.all_sprites.add(bullet)
        self.enemy_bullets.add(bullet)

# --- ARQUITECTURA PRINCIPAL ASÍNCRONA ---
async def main():
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Galaga - Proyecto Final Web")
    clock = pygame.time.Clock()
    
    load_assets()

    while True:
        token, current_user = await login_screen(screen, clock)

        if token:
            profile = await auth.get_profile(token)
            coins = profile.get("coins", 0)
            current_skin = profile.get("current_skin", "player_default")
            owned_skins = profile.get("owned_skins", "player_default").split(',')
        else:
            coins, current_skin, owned_skins = 0, "player_default", ["player_default"]

        while True:
            action = await lobby_screen(screen, clock, current_user, coins, current_skin)

            if action == "LOGOUT":
                break 
                
            elif action == "SHOP_LOCKER":
                if token:
                    coins, current_skin, owned_skins = await shop_and_locker(screen, clock, token, coins, owned_skins, current_skin, "SHOP")
                
            elif action == "PLAY":
                if music_loaded: pygame.mixer.music.play(-1)

                game_over, running, score = False, True, 0
                all_sprites, bullets, enemies, enemy_bullets = pygame.sprite.Group(), pygame.sprite.Group(), pygame.sprite.Group(), pygame.sprite.Group()
                
                player = Player(all_sprites, bullets, assets.get(current_skin, assets["player_default"]))
                all_sprites.add(player)
                
                for row in range(3):
                    for col in range(7):
                        enemy = Enemy(all_sprites, enemy_bullets, col, row)
                        all_sprites.add(enemy); enemies.add(enemy)

                while running:
                    if game_over:
                        if music_loaded: pygame.mixer.music.stop()
                        await show_go_screen(screen, score, token)
                        if token:
                            profile = await auth.get_profile(token)
                            coins = profile.get("coins", coins)
                        break 

                    for event in pygame.event.get():
                        if event.type == pygame.QUIT: sys.exit()

                    all_sprites.update()

                    hits = pygame.sprite.groupcollide(enemies, bullets, False, True)
                    for enemy, bullet_list in hits.items():
                        enemy.hp -= len(bullet_list)
                        if enemy.tipo == 'jefe' and enemy.hp == 1: enemy.image.set_alpha(150) 
                        if enemy.hp <= 0:
                            score += enemy.points
                            col, row = enemy.col, enemy.row 
                            enemy.kill()
                            if expl_sound: expl_sound.play()
                            new_enemy = Enemy(all_sprites, enemy_bullets, col, row)
                            all_sprites.add(new_enemy); enemies.add(new_enemy)

                    player_hit = pygame.sprite.spritecollide(player, enemies, False) or pygame.sprite.spritecollide(player, enemy_bullets, False)
                    if player_hit and not player.hidden:
                        if expl_sound: expl_sound.play()
                        player.hide()
                        player.lives -= 1
                        if player.lives <= 0: game_over = True

                    screen.fill(BLACK)
                    for star in stars:
                        star[1] += star[2] 
                        if star[1] > HEIGHT: star[1], star[0] = random.randrange(-20, -5), random.randrange(0, WIDTH)
                        pygame.draw.rect(screen, LIGHT_GREY, (star[0], star[1], star[3], star[3]))

                    all_sprites.draw(screen)
                    draw_text(screen, f"SCORE: {score}", 24, WIDTH - 20, 10, align="topright")
                    draw_lives(screen, 10, 10, player.lives) 
                    
                    pygame.display.flip()
                    clock.tick(FPS)
                    await asyncio.sleep(0)

if __name__ == "__main__":
    asyncio.run(main())