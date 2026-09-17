import pygame
import sys
import random
import os
import math
import auth

# --- Configuración Básica ---
WIDTH, HEIGHT = 800, 600
FPS = 60

# --- Colores ---
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
LIGHT_GREY = (200, 200, 200)

# --- Fondo Animado (Starfield) ---
NUM_STARS = 100
stars = []
for i in range(NUM_STARS):
    x = random.randrange(0, WIDTH)
    y = random.randrange(0, HEIGHT)
    speed = random.randrange(1, 5)
    size = random.randrange(1, 3)
    stars.append([x, y, speed, size])

# Inicializamos Pygame y el mezclador de audio
pygame.mixer.init()
pygame.init()
font_name = pygame.font.match_font('arial')

player_img = None
mini_player_img = None
laser_img = None
blue_img = None
red_img = None
green_img = None

shoot_sound = None
expl_sound = None

def load_assets():
    global player_img, mini_player_img, laser_img, blue_img, red_img, green_img
    global shoot_sound, expl_sound
    
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
        shoot_sound = None
        expl_sound = None

def draw_text(surf, text, size, x, y, align="midtop"):
    font = pygame.font.Font(font_name, size)
    text_surface = font.render(text, True, WHITE)
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

# NUEVA VERSIÓN DE PANTALLA GAME OVER CON LEADERBOARD
def show_go_screen(screen, score, token):
    screen.fill(BLACK)
    draw_text(screen, "GAME OVER", 64, WIDTH // 2, HEIGHT // 4)
    draw_text(screen, f"Puntuación Final: {score}", 22, WIDTH // 2, HEIGHT // 2)
    draw_text(screen, "Conectando con la base de datos...", 18, WIDTH // 2, HEIGHT * 3 // 4)
    pygame.display.flip()
    
    # Si hizo puntos, los guardamos a través de la API
    if score > 0:
        auth.save_score(token, score)
    
    # Pausa ligera y obtenemos el Top de pilotos
    pygame.time.wait(1000)
    leaderboard = auth.get_leaderboard()
    
    screen.fill(BLACK)
    draw_text(screen, "GAME OVER", 50, WIDTH // 2, HEIGHT // 8)
    draw_text(screen, f"Tu Puntuación: {score}", 24, WIDTH // 2, HEIGHT // 8 + 60)
    
    # Dibujamos el Top 5
    draw_text(screen, "--- TOP PILOTOS ---", 22, WIDTH // 2, HEIGHT // 2 - 40)
    y_offset = HEIGHT // 2 
    for i, p in enumerate(leaderboard[:5]):
        texto = f"{i+1}. {p['username']} - {p['score']} pts"
        draw_text(screen, texto, 20, WIDTH // 2, y_offset)
        y_offset += 30
        
    draw_text(screen, "Presiona cualquier tecla para reiniciar", 18, WIDTH // 2, HEIGHT - 50)
    pygame.display.flip()
    
    pygame.time.wait(1000) # Evita que saltes la pantalla por error
    pygame.event.clear()
    
    waiting = True
    clock = pygame.time.Clock()
    while waiting:
        clock.tick(FPS)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYUP:
                waiting = False

class Player(pygame.sprite.Sprite):
    def __init__(self, all_sprites, bullets):
        super().__init__()
        self.image = player_img
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
                    self.pos_x = float(self.target_x)
                    self.pos_y = float(-100)
                elif self.tipo == 'mariposa':
                    self.pos_x = float(-100)
                    self.pos_y = float(random.randint(0, HEIGHT // 3))
                else:
                    self.pos_x = float(WIDTH + 100)
                    self.pos_y = float(random.randint(0, HEIGHT // 3))
                
    def shoot(self):
        bullet = EnemyBullet(self.rect.centerx, self.rect.bottom)
        self.all_sprites.add(bullet)
        self.enemy_bullets.add(bullet)

def main():
    print("\n" + "="*40)
    print("🛸 BIENVENIDO A GALAGA - TERMINAL DE ACCESO 🛸")
    print("="*40)
    username = input("👤 Ingresa tu usuario: ")
    password = input("🔑 Ingresa tu contraseña: ")
    
    token = auth.login(username, password)
    if not token:
        sys.exit()
        
    print("✅ Acceso concedido. Inicializando motor gráfico...\n")

    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Galaga - Proyecto Final Ingeniería de Software")
    clock = pygame.time.Clock()
    
    load_assets()

    game_over = False
    running = True
    score = 0
    
    all_sprites = pygame.sprite.Group()
    bullets = pygame.sprite.Group()
    enemies = pygame.sprite.Group()
    enemy_bullets = pygame.sprite.Group() 
    
    player = Player(all_sprites, bullets)
    all_sprites.add(player)
    
    for row in range(3):
        for col in range(7):
            enemy = Enemy(all_sprites, enemy_bullets, col, row)
            all_sprites.add(enemy)
            enemies.add(enemy)

    while running:
        if game_over:
            # Enviamos el token a la pantalla de game over para que guarde el puntaje
            show_go_screen(screen, score, token)
            game_over = False
            
            all_sprites = pygame.sprite.Group()
            bullets = pygame.sprite.Group()
            enemies = pygame.sprite.Group()
            enemy_bullets = pygame.sprite.Group()
            
            player = Player(all_sprites, bullets)
            all_sprites.add(player)
            for row in range(3):
                for col in range(7):
                    enemy = Enemy(all_sprites, enemy_bullets, col, row)
                    all_sprites.add(enemy)
                    enemies.add(enemy)
            score = 0

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
                
                if expl_sound:
                    expl_sound.play()
                
                new_enemy = Enemy(all_sprites, enemy_bullets, col, row)
                all_sprites.add(new_enemy)
                enemies.add(new_enemy)

        player_hit = pygame.sprite.spritecollide(player, enemies, False) or pygame.sprite.spritecollide(player, enemy_bullets, False)
        if player_hit and not player.hidden:
            if expl_sound:
                expl_sound.play()
            
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
                star[2] = random.randrange(1, 5)
                star[3] = random.randrange(1, 3)
            pygame.draw.rect(screen, LIGHT_GREY, (star[0], star[1], star[3], star[3]))

        all_sprites.draw(screen)
        
        draw_text(screen, f"SCORE: {score}", 24, WIDTH - 20, 10, align="topright")
        draw_lives(screen, 10, 10, player.lives, mini_player_img)
        
        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()