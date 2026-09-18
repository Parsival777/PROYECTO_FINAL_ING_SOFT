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
music_loaded = False # Variable para el soundtrack

def load_assets():
    global player_img, mini_player_img, laser_img, blue_img, red_img, green_img
    global shoot_sound, expl_sound, music_loaded
    img_dir = os.path.join(os.path.dirname(__file__), 'img')
    snd_dir = os.path.join(os.path.dirname(__file__), 'snd')
    
    player_img = pygame.transform.scale(pygame.image.load(os.path.join(img_dir, 'main_ship.png')).convert_alpha(), (40, 40))
    mini_player_img = pygame.transform.scale(player_img, (25, 25))
    laser_img = pygame.transform.scale(pygame.image.load(os.path.join(img_dir, 'laser.png')).convert_alpha(), (25, 40))
    blue_img = pygame.transform.scale(pygame.image.load(os.path.join(img_dir, 'blue_ship.png')).convert_alpha(), (40, 40))
    red_img = pygame.transform.scale(pygame.image.load(os.path.join(img_dir, 'red_ship.png')).convert_alpha(), (40, 40))
    green_img = pygame.transform.scale(pygame.image.load(os.path.join(img_dir, 'green_ship.png')).convert_alpha(), (40, 40))

    try:
        shoot_sound = pygame.mixer.Sound(os.path.join(snd_dir, 'laser.wav'))
        shoot_sound.set_volume(0.3)
        expl_sound = pygame.mixer.Sound(os.path.join(snd_dir, 'explosion.wav'))
        expl_sound.set_volume(0.4)
    except FileNotFoundError:
        shoot_sound = expl_sound = None

    # Carga del Soundtrack (.ogg obligatorio para web)
    try:
        pygame.mixer.music.load(os.path.join(snd_dir, 'musica.ogg'))
        pygame.mixer.music.set_volume(0.5)
        music_loaded = True
    except Exception as e:
        print(f"⚠️ Soundtrack desactivado: {e}")
        music_loaded = False

def draw_text(surf, text, size, x, y, align="midtop", color=WHITE):
    font = pygame.font.Font(font_name, size)
    text_surface = font.render(text, True, color)
    text_rect = text_surface.get_rect()
    if align == "midtop":
        text_rect.midtop = (x, y)
    elif align == "topright":
        text_rect.topright = (x, y)
    surf.blit(text_surface, text_rect)

def draw_lives(surf, x, y, lives, img):
    for i in range(lives):
        img_rect = img.get_rect()
        img_rect.x = x + 30 * i
        img_rect.y = y
        surf.blit(img, img_rect)

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
                # Bloqueamos el TAB y el ESC para que no se escriban en la caja
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

# --- PANTALLA DE LOGIN GRÁFICA ASÍNCRONA (MODIFICADA CON REGISTRO E INVITADO) ---
async def login_screen(screen, clock):
    input_box1 = InputBox(WIDTH // 2 - 100, HEIGHT // 2 - 40, 200, 32)
    input_box2 = InputBox(WIDTH // 2 - 100, HEIGHT // 2 + 20, 200, 32, is_password=True)
    input_boxes = [input_box1, input_box2]
    error_msg = ""
    estado = "LOGIN"
    
    while True:
        screen.fill(BLACK)
        
        # Estrellas de fondo
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
                
            # Interceptamos teclas de navegación de estado
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_TAB:
                    estado = "REGISTRO" if estado == "LOGIN" else "LOGIN"
                    error_msg = f"Modo {estado} activado."
                elif event.key == pygame.K_ESCAPE:
                    return None, "Invitado"
            
            for box in input_boxes:
                box.handle_event(event)
            
            # Intento de acceso o registro
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
                            error_msg = "❌ Credenciales inválidas o error de conexión."
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

# --- PANTALLA GAME OVER ASÍNCRONA (MODIFICADA CON PROTECCIÓN) ---
async def show_go_screen(screen, score, token):
    screen.fill(BLACK)
    draw_text(screen, "GAME OVER", 64, WIDTH // 2, HEIGHT // 4)
    draw_text(screen, f"Puntuación Final: {score}", 22, WIDTH // 2, HEIGHT // 2)
    
    if token and score > 0:
        draw_text(screen, "Guardando puntuación en TiDB...", 18, WIDTH // 2, HEIGHT * 3 // 4)
        pygame.display.flip()
        await auth.save_score(token, score)
    elif not token:
        draw_text(screen, "Modo Invitado: Puntuación no registrada.", 18, WIDTH // 2, HEIGHT * 3 // 4, color=RED)
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
        
    draw_text(screen, "Presiona ESPACIO para reiniciar", 18, WIDTH // 2, HEIGHT - 50)
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

# --- CLASES DEL JUEGO (MODIFICADA PARA ACEPTAR SKINS) ---
class Player(pygame.sprite.Sprite):
    def __init__(self, all_sprites, bullets, skin_img):
        super().__init__()
        self.image = skin_img # Se asigna la skin dictada por la nube
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
            if keystate[pygame.K_LEFT]:
                self.speedx = -6 
            if keystate[pygame.K_RIGHT]:
                self.speedx = 6
            if keystate[pygame.K_SPACE]:
                self.shoot()
                
        self.rect.x += self.speedx
        if self.rect.right > WIDTH:
            self.rect.right = WIDTH
        if self.rect.left < 0:
            self.rect.left = 0

    def shoot(self):
        now = pygame.time.get_ticks()
        if now - self.last_shot > self.shoot_delay:
            self.last_shot = now
            bullet = Bullet(self.rect.centerx, self.rect.top)
            self.all_sprites.add(bullet)
            self.bullets.add(bullet)
            if shoot_sound:
                shoot_sound.play()
            
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
        if self.rect.bottom < 0:
            self.kill()

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
        if self.rect.top > HEIGHT:
            self.kill()

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
                if self.tipo == 'jefe':
                    self.pos_x, self.pos_y = float(self.target_x), float(-100)
                elif self.tipo == 'mariposa':
                    self.pos_x, self.pos_y = float(-100), float(random.randint(0, HEIGHT // 3))
                else:
                    self.pos_x, self.pos_y = float(WIDTH + 100), float(random.randint(0, HEIGHT // 3))
                
    def shoot(self):
        bullet = EnemyBullet(self.rect.centerx, self.rect.bottom)
        self.all_sprites.add(bullet)
        self.enemy_bullets.add(bullet)

# --- CICLO PRINCIPAL ASÍNCRONO ---
async def main():
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Galaga - Proyecto Final Web")
    clock = pygame.time.Clock()
    
    load_assets()

    token, current_user = await login_screen(screen, clock)

    # --- LÓGICA DE PROGRESIÓN (SaaS) ---
    skin_actual = player_img # Nave base por defecto
    rango = "Invitado"
    
    if token:
        screen.fill(BLACK)
        draw_text(screen, "Sincronizando perfil con TiDB Cloud...", 24, WIDTH // 2, HEIGHT // 2)
        pygame.display.flip()
        
        board = await auth.get_leaderboard()
        max_score = 0
        for p in board:
            if p['username'] == current_user:
                if p['score'] > max_score:
                    max_score = p['score']
        
        # Asignación de skins (reutilizamos las de los enemigos para el jugador)
        if max_score >= 10000:
            skin_actual = green_img
            rango = "Élite"
        elif max_score >= 5000:
            skin_actual = blue_img
            rango = "Pro"
        else:
            rango = "Novato"

    if music_loaded:
        pygame.mixer.music.play(-1)

    game_over = False
    running = True
    score = 0
    
    all_sprites = pygame.sprite.Group()
    bullets = pygame.sprite.Group()
    enemies = pygame.sprite.Group()
    enemy_bullets = pygame.sprite.Group() 
    
    player = Player(all_sprites, bullets, skin_actual)
    all_sprites.add(player)
    
    for row in range(3):
        for col in range(7):
            enemy = Enemy(all_sprites, enemy_bullets, col, row)
            all_sprites.add(enemy)
            enemies.add(enemy)

    while running:
        if game_over:
            if music_loaded: pygame.mixer.music.stop()
            await show_go_screen(screen, score, token)
            game_over = False
            
            all_sprites.empty()
            bullets.empty()
            enemies.empty()
            enemy_bullets.empty()
            
            # Se reasigna la skin al reiniciar
            player = Player(all_sprites, bullets, skin_actual)
            all_sprites.add(player)
            for row in range(3):
                for col in range(7):
                    enemy = Enemy(all_sprites, enemy_bullets, col, row)
                    all_sprites.add(enemy)
                    enemies.add(enemy)
            score = 0
            if music_loaded: pygame.mixer.music.play(-1)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        all_sprites.update()

        hits = pygame.sprite.groupcollide(enemies, bullets, False, True)
        for enemy, bullet_list in hits.items():
            enemy.hp -= len(bullet_list)
            if enemy.tipo == 'jefe' and enemy.hp == 1:
                enemy.image.set_alpha(150) 
            if enemy.hp <= 0:
                score += enemy.points
                col, row = enemy.col, enemy.row 
                enemy.kill()
                if expl_sound: expl_sound.play()
                
                new_enemy = Enemy(all_sprites, enemy_bullets, col, row)
                all_sprites.add(new_enemy)
                enemies.add(new_enemy)

        player_hit = pygame.sprite.spritecollide(player, enemies, False) or pygame.sprite.spritecollide(player, enemy_bullets, False)
        if player_hit and not player.hidden:
            if expl_sound: expl_sound.play()
            player.hide()
            player.lives -= 1
            if player.lives <= 0:
                game_over = True

        screen.fill(BLACK)

        for star in stars:
            star[1] += star[2] 
            if star[1] > HEIGHT:
                star[1] = random.randrange(-20, -5)
                star[0] = random.randrange(0, WIDTH)
            pygame.draw.rect(screen, LIGHT_GREY, (star[0], star[1], star[3], star[3]))

        all_sprites.draw(screen)
        draw_text(screen, f"SCORE: {score} | {current_user} ({rango})", 22, WIDTH - 20, 10, align="topright")
        draw_lives(screen, 10, 10, player.lives, mini_player_img)
        
        pygame.display.flip()
        clock.tick(FPS)
        
        await asyncio.sleep(0)

if __name__ == "__main__":
    asyncio.run(main())