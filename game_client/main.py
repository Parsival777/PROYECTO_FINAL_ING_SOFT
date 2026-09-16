import pygame
import sys
import random
import auth

# --- Configuración Básica ---
WIDTH, HEIGHT = 800, 600
FPS = 60

# --- Colores ---
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
YELLOW = (255, 255, 0)
RED = (255, 0, 0)

# Inicializamos Pygame para poder cargar la fuente de texto
pygame.init()
font_name = pygame.font.match_font('arial')

# --- Función para dibujar texto en pantalla ---
def draw_text(surf, text, size, x, y):
    font = pygame.font.Font(font_name, size)
    text_surface = font.render(text, True, WHITE)
    text_rect = text_surface.get_rect()
    text_rect.midtop = (x, y)
    surf.blit(text_surface, text_rect)

# --- Clase del Jugador ---
class Player(pygame.sprite.Sprite):
    def __init__(self, all_sprites, bullets):
        super().__init__()
        self.image = pygame.Surface((40, 40))
        self.image.fill(GREEN)
        self.rect = self.image.get_rect()
        self.rect.centerx = WIDTH // 2
        self.rect.bottom = HEIGHT - 20
        self.speedx = 0
        
        self.all_sprites = all_sprites
        self.bullets = bullets
        
        self.shoot_delay = 250
        self.last_shot = pygame.time.get_ticks()

    def update(self):
        self.speedx = 0
        keystate = pygame.key.get_pressed()
        
        if keystate[pygame.K_LEFT]:
            self.speedx = -5
        if keystate[pygame.K_RIGHT]:
            self.speedx = 5
            
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

# --- Clase de la Bala ---
class Bullet(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = pygame.Surface((5, 15))
        self.image.fill(YELLOW)
        self.rect = self.image.get_rect()
        self.rect.bottom = y
        self.rect.centerx = x
        self.speedy = -10

    def update(self):
        self.rect.y += self.speedy
        if self.rect.bottom < 0:
            self.kill()

# --- Clase del Enemigo ---
class Enemy(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.image = pygame.Surface((30, 30))
        self.image.fill(RED)
        self.rect = self.image.get_rect()
        self.rect.x = random.randrange(0, WIDTH - self.rect.width)
        self.rect.y = random.randrange(-100, -40)
        self.speedy = random.randrange(1, 4)

    def update(self):
        self.rect.y += self.speedy
        if self.rect.top > HEIGHT + 10:
            self.rect.x = random.randrange(0, WIDTH - self.rect.width)
            self.rect.y = random.randrange(-100, -40)
            self.speedy = random.randrange(1, 4)

# --- Función Principal ---
def main():
    # --- SISTEMA DE AUTENTICACIÓN (CLI) ---
    print("\n" + "="*40)
    print("🛸 BIENVENIDO A GALAGA - TERMINAL DE ACCESO 🛸")
    print("="*40)
    username = input("👤 Ingresa tu usuario: ")
    password = input("🔑 Ingresa tu contraseña: ")
    
    # Llamamos a la API usando la función de tu archivo auth.py
    token = auth.login(username, password)
    
    if not token:
        print("❌ Acceso denegado. Credenciales incorrectas o API apagada.")
        print("Cerrando el sistema...")
        sys.exit()
        
    print("✅ Acceso concedido. Inicializando motor gráfico...\n")
    # --------------------------------------

    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Galaga - Proyecto Final Ingeniería de Software")
    clock = pygame.time.Clock()

    all_sprites = pygame.sprite.Group()
    bullets = pygame.sprite.Group()
    enemies = pygame.sprite.Group()

    player = Player(all_sprites, bullets)
    all_sprites.add(player)

    for i in range(8):
        enemy = Enemy()
        all_sprites.add(enemy)
        enemies.add(enemy)

    score = 0

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        all_sprites.update()

        # Colisión: Bala vs Enemigo
        hits = pygame.sprite.groupcollide(enemies, bullets, True, True)
        for hit in hits:
            score += 10
            new_enemy = Enemy()
            all_sprites.add(new_enemy)
            enemies.add(new_enemy)

        # Colisión: Enemigo vs Jugador (GAME OVER)
        player_hit = pygame.sprite.spritecollide(player, enemies, False)
        if player_hit:
            running = False 

        screen.fill(BLACK)
        all_sprites.draw(screen)
        
        draw_text(screen, f"Puntos: {score}", 30, WIDTH // 2, 10)
        
        pygame.display.flip()
        clock.tick(FPS)

    print(f"\n💥 FIN DEL JUEGO. Puntuación Final: {score} 💥")
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()