const API_URL = "/api";
let state = {
    token: null, user: "Invitado", coins: 0, 
    currentSkin: "player_default", ownedSkins: ["player_default"]
};

const CATALOG = [
    { id: "player_default", name: "Nave Base", price: 0, rarity: "common", src: "img/main_ship.png" },
    { id: "skin_stealth", name: "Caza Furtivo", price: 1500, rarity: "epic", src: "img/skin_stealth.png" },
    { id: "skin_neon", name: "Neón Cósmico", price: 3000, rarity: "legendary", src: "img/skin_neon.png" }
];

async function apiCall(endpoint, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method, headers, body: body ? JSON.stringify(body) : null
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
    } catch (e) {
        return { status: 500, data: { error: "Error de conexión." } };
    }
}

async function loadProfile() {
    if (!state.token) return;
    const res = await apiCall("/me");
    if (res.status === 200) {
        state.coins = res.data.coins || 0;
        state.currentSkin = res.data.current_skin || "player_default";
        state.ownedSkins = res.data.owned_skins ? res.data.owned_skins.split(',') : ["player_default"];
    }
}

const screens = ["auth-screen", "lobby-screen", "shop-screen", "gameover-screen"];

function showScreen(id) {
    screens.forEach(s => document.getElementById(s).classList.remove("active"));
    canvas.style.display = "none";
    document.getElementById("hud").style.display = "none";
    if(id) document.getElementById(id).classList.add("active");
}

function msg(id, text, color="#ff0000") {
    const el = document.getElementById(id);
    if(el) { el.innerText = text; el.style.color = color; }
}

document.getElementById("btn-login").onclick = async () => {
    const u = document.getElementById("username").value, p = document.getElementById("password").value;
    if(!u || !p) return msg("auth-msg", "Campos vacíos.");
    msg("auth-msg", "Conectando...", "#fff");
    const res = await apiCall("/login", "POST", {username: u, password: p});
    if(res.status === 200) { state.token = res.data.token; state.user = u; enterLobby(); }
    else msg("auth-msg", res.data.error || "Credenciales inválidas.");
};

document.getElementById("btn-register").onclick = async () => {
    const u = document.getElementById("username").value, p = document.getElementById("password").value;
    if(!u || !p) return msg("auth-msg", "Campos vacíos.");
    msg("auth-msg", "Registrando...", "#fff");
    const res = await apiCall("/register", "POST", {username: u, password: p});
    if(res.status === 201) msg("auth-msg", "Cuenta creada. Inicia sesión.", "#00ff00");
    else msg("auth-msg", res.data.error || "Error al registrar.");
};

document.getElementById("btn-guest").onclick = () => {
    state.token = null; state.user = "Invitado"; enterLobby();
};

document.getElementById("btn-logout").onclick = () => {
    state.token = null; document.getElementById("username").value = ""; document.getElementById("password").value = "";
    showScreen("auth-screen"); msg("auth-msg", "");
};

async function enterLobby() {
    msg("auth-msg", "");
    if(state.token) {
        msg("lobby-user", "Sincronizando...", "#fff"); showScreen("lobby-screen");
        await loadProfile();
    }
    document.getElementById("lobby-user").innerText = `Piloto: ${state.user}`;
    document.getElementById("lobby-coins").innerText = `Billetera: ${state.coins} 🪙`;
    const skinName = CATALOG.find(s => s.id === state.currentSkin)?.name || "Base";
    document.getElementById("lobby-skin").innerText = `Nave Actual: ${skinName}`;
    showScreen("lobby-screen");
}

document.getElementById("btn-shop").onclick = () => renderShop();
document.getElementById("btn-back-lobby").onclick = enterLobby;

// Lógica de Tienda y Locker unificada
async function renderShop() {
    showScreen("shop-screen");
    document.getElementById("shop-title").innerText = "🏪 TIENDA Y LOCKER 🏪";
    document.getElementById("shop-coins").innerText = `Tus Monedas: ${state.coins} 🪙`;
    msg("shop-msg", "");

    const container = document.getElementById("shop-container");
    container.innerHTML = "";

    CATALOG.forEach(item => {
        let status = "", actionText = "", btnClass = "", disabled = false;
        const owned = state.ownedSkins.includes(item.id);
        const equipped = state.currentSkin === item.id;

        if (equipped) { 
            status = "EQUIPADO"; 
            actionText = "En Uso"; 
            btnClass = "btn-alt"; 
            disabled = true; 
        } else if (owned) { 
            status = "DISPONIBLE"; 
            actionText = "Equipar"; 
            btnClass = "btn-alt"; 
        } else { 
            status = `${item.price} 🪙`; 
            actionText = "Comprar"; 
        }

        const card = document.createElement("div");
        card.className = `card ${item.rarity} ${equipped ? 'equipped' : ''}`;
        card.innerHTML = `
            <img src="${item.src}" alt="${item.name}">
            <h3 style="margin-bottom:10px; font-size:14px;">${item.name}</h3>
            <p style="margin-bottom:15px; color:#fff;">${status}</p>
            <button class="${btnClass}" ${disabled ? "disabled style='opacity:0.5; cursor:not-allowed;'" : ""} 
                onclick="handleItemClick('${item.id}', ${item.price}, ${owned})">${actionText}</button>
        `;
        container.appendChild(card);
    });
}

async function handleItemClick(id, price, isOwned) {
    if(!state.token) return msg("shop-msg", "Regístrate para usar la tienda.");
    
    if (!isOwned) {
        // Flujo de compra
        const res = await apiCall("/shop", "POST", { skin_name: id, cost: price });
        if(res.status === 200) { 
            state.coins -= price; 
            state.ownedSkins.push(id); 
            state.currentSkin = id; 
            renderShop(); 
        } else {
            msg("shop-msg", res.data.error);
        }
    } else {
        // Flujo de equipar
        const res = await apiCall("/equip", "POST", { skin_name: id });
        if(res.status === 200) { 
            state.currentSkin = id; 
            renderShop(); 
        } else {
            msg("shop-msg", res.data.error);
        }
    }
}

// --- MOTOR DE JUEGO HTML5 CANVAS ---
const canvas = document.getElementById("gameCanvas");
canvas.width = 800;
canvas.height = 600;
const ctx = canvas.getContext("2d");

const imagePaths = {
    'player_default': 'img/main_ship.png',
    'skin_stealth': 'img/skin_stealth.png', 
    'skin_neon': 'img/skin_neon.png',    
    'laser': 'img/laser.png',
    'red_ship': 'img/red_ship.png',
    'blue_ship': 'img/blue_ship.png',
    'green_ship': 'img/green_ship.png',
    'heart': 'img/heart.png'
};

const images = {};
for (let key in imagePaths) {
    images[key] = new Image();
    images[key].src = imagePaths[key];
}

const sndShoot = new Audio('snd/laserShoot.wav'); sndShoot.volume = 0.3;
const sndExpl = new Audio('snd/explosion.wav'); sndExpl.volume = 0.4;

let gameLoopId, gameActive = false;
let player, bullets, enemies, enemyBullets, starsArr, score;
let lastTime = 0;
const fpsInterval = 1000 / 60; 

class Player {
    constructor(skinId) {
        this.w = 40; this.h = 40;
        this.x = canvas.width/2 - this.w/2; this.y = canvas.height - this.h - 10;
        this.speed = 6; this.lives = 3; this.hidden = false; this.hideTime = 0;
        this.lastShot = 0;
        this.imgName = skinId || 'player_default'; 
    }
    draw() {
        if(!this.hidden) {
            if (images[this.imgName] && images[this.imgName].complete && images[this.imgName].naturalWidth > 0) {
                ctx.drawImage(images[this.imgName], this.x, this.y, this.w, this.h);
            } else {
                ctx.fillStyle = "#00ffff"; 
                ctx.fillRect(this.x, this.y, this.w, this.h);
            }
        }
    }
    update(keys) {
        if(this.hidden) {
            if(Date.now() - this.hideTime > 1500) { this.hidden = false; this.x = canvas.width/2 - this.w/2; }
            return;
        }
        if(keys['ArrowLeft'] && this.x > 0) this.x -= this.speed;
        if(keys['ArrowRight'] && this.x < canvas.width - this.w) this.x += this.speed;
        if(keys[' '] && Date.now() - this.lastShot > 250) {
            bullets.push(new Bullet(this.x + this.w/2 - 12.5, this.y));
            this.lastShot = Date.now();
            sndShoot.currentTime = 0; sndShoot.play().catch(()=>{});
        }
    }
    hit() {
        this.hidden = true; this.hideTime = Date.now(); this.lives--;
        sndExpl.currentTime = 0; sndExpl.play().catch(()=>{});
    }
}

class Bullet {
    constructor(x, y) { this.x = x; this.y = y; this.w = 25; this.h = 40; this.speed = -12; this.active = true; }
    draw() { 
        if(images['laser'] && images['laser'].complete && images['laser'].naturalWidth > 0) {
            ctx.drawImage(images['laser'], this.x, this.y, this.w, this.h); 
        } else {
            ctx.fillStyle = "#ffff00";
            ctx.fillRect(this.x + 10, this.y, 5, 20);
        }
    }
    update() { this.y += this.speed; if(this.y < 0) this.active = false; }
}

class EnemyBullet {
    constructor(x, y) { this.x = x; this.y = y; this.w = 6; this.h = 15; this.speed = 4; this.active = true; }
    draw() { ctx.fillStyle = "#ff3232"; ctx.fillRect(this.x, this.y, this.w, this.h); }
    update() { this.y += this.speed; if(this.y > canvas.height) this.active = false; }
}

class Enemy {
    constructor(col, row) {
        this.col = col; this.row = row; this.w = 40; this.h = 40;
        this.targetX = 120 + (col * 80); this.targetY = 60 + (row * 60);
        this.active = true; this.state = 'entering'; this.diveStartX = 0;
        
        if (row === 0) {
            this.type = 'jefe'; this.imgName = 'green_ship'; this.hp = 2; this.points = 150;
            this.diveSpeed = 1.6 + Math.random()*0.8; this.curve = 40; this.diveProb = 0.0005;
            this.x = this.targetX; this.y = -100;
        } else if (row === 1) {
            this.type = 'mariposa'; this.imgName = 'red_ship'; this.hp = 1; this.points = 80;
            this.diveSpeed = 1.8 + Math.random()*0.5; this.curve = 60; this.diveProb = 0.002;
            this.x = -100; this.y = Math.random() * 200;
        } else {
            this.type = 'abeja'; this.imgName = 'blue_ship'; this.hp = 1; this.points = 50;
            this.diveSpeed = 2.3 + Math.random()*0.7; this.curve = 80; this.diveProb = 0.0035;
            this.x = canvas.width + 100; this.y = Math.random() * 200;
        }
    }
    draw() {
        ctx.globalAlpha = this.hp === 1 && this.type === 'jefe' ? 0.6 : 1.0;
        if(images[this.imgName] && images[this.imgName].complete && images[this.imgName].naturalWidth > 0) {
            ctx.drawImage(images[this.imgName], this.x, this.y, this.w, this.h);
        } else {
            ctx.fillStyle = this.type === 'jefe' ? "#00ff00" : (this.type === 'mariposa' ? "#ff0000" : "#0000ff");
            ctx.fillRect(this.x, this.y, this.w, this.h);
        }
        ctx.globalAlpha = 1.0;
    }
    update() {
        if (this.state === 'entering') {
            this.x += (this.targetX - this.x) * 0.03; this.y += (this.targetY - this.y) * 0.03;
            if (Math.abs(this.targetX - this.x) < 2 && Math.abs(this.targetY - this.y) < 2) this.state = 'formation';
        } else if (this.state === 'formation') {
            this.x = this.targetX + Math.sin(Date.now() / 500) * 20;
            this.y = this.targetY + Math.cos(Date.now() / 500) * 10;
            if (Math.random() < this.diveProb) {
                this.state = 'diving'; this.diveStartX = this.x;
            }
            if (this.type === 'jefe' && Math.random() < 0.002) enemyBullets.push(new EnemyBullet(this.x + this.w/2, this.y + this.h));
        } else if (this.state === 'diving') {
            this.y += this.diveSpeed;
            this.x = this.diveStartX + Math.sin(this.y / 50) * this.curve;
            if (this.type === 'jefe' && Math.random() < 0.01) enemyBullets.push(new EnemyBullet(this.x + this.w/2, this.y + this.h));
            if (this.y > canvas.height) {
                this.state = 'entering';
                if(this.type === 'jefe') { this.x = this.targetX; this.y = -100; }
                else if(this.type === 'mariposa') { this.x = -100; this.y = Math.random()*200; }
                else { this.x = canvas.width + 100; this.y = Math.random()*200; }
            }
        }
    }
}

const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

document.getElementById("btn-play").onclick = () => {
    showScreen(null); 
    canvas.style.display = "block";
    document.getElementById("hud").style.display = "flex";
    
    player = new Player(state.currentSkin);
    bullets = []; enemies = []; enemyBullets = []; score = 0;
    
    for(let row=0; row<3; row++) {
        for(let col=0; col<7; col++) enemies.push(new Enemy(col, row));
    }
    
    starsArr = Array.from({length: 100}, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        s: 1 + Math.random() * 4, size: 1 + Math.random() * 2
    }));

    gameActive = true;
    lastTime = performance.now(); 
    gameLoop();
};

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

function updateHUD() {
    const scoreEl = document.getElementById("score-display");
    if(scoreEl) scoreEl.innerText = `SCORE: ${score}`;
    
    const lc = document.getElementById("lives-container");
    if(lc) {
        lc.innerHTML = "";
        for(let i=0; i<player.lives; i++) {
            if(images['heart'] && images['heart'].complete && images['heart'].naturalWidth > 0) {
                const heartImg = images['heart'].cloneNode();
                heartImg.style.width = "25px";
                heartImg.style.height = "25px";
                lc.appendChild(heartImg);
            } else {
                const span = document.createElement("span");
                span.innerText = "❤️ ";
                lc.appendChild(span);
            }
        }
    }
}

function gameLoop(timestamp) {
    if(!gameActive) return;
    
    gameLoopId = requestAnimationFrame(gameLoop);
    
    if (!timestamp) timestamp = performance.now();
    const elapsed = timestamp - lastTime;
    
    if (elapsed > fpsInterval) {
        lastTime = timestamp - (elapsed % fpsInterval);
        
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#c8c8c8";
        starsArr.forEach(s => {
            s.y += s.s; if(s.y > canvas.height) { s.y = -10; s.x = Math.random() * canvas.width; }
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });

        player.update(keys); player.draw();
        
        bullets.forEach(b => { b.update(); b.draw(); });
        enemyBullets.forEach(b => { b.update(); b.draw(); });
        
        enemies.forEach(e => {
            e.update(); e.draw();
            
            if(!player.hidden && checkCollision(player, e)) { player.hit(); }
            
            bullets.forEach(b => {
                if(b.active && checkCollision(b, e)) {
                    b.active = false; e.hp--;
                    if(e.hp <= 0) {
                        e.active = false; score += e.points;
                        sndExpl.currentTime = 0; sndExpl.play().catch(()=>{});
                        enemies.push(new Enemy(e.col, e.row)); 
                    }
                }
            });
        });

        enemyBullets.forEach(b => {
            if(b.active && !player.hidden && checkCollision(b, player)) { b.active = false; player.hit(); }
        });

        bullets = bullets.filter(b => b.active);
        enemyBullets = enemyBullets.filter(b => b.active);
        enemies = enemies.filter(e => e.active);

        updateHUD();

        if(player.lives <= 0) return endGame();
    }
}

async function endGame() {
    gameActive = false; 
    showScreen("gameover-screen");
    canvas.style.display = "none";
    document.getElementById("hud").style.display = "none";
    
    const scoreEl = document.getElementById("go-score");
    if(scoreEl) scoreEl.innerText = `Puntuación: ${score}`;
    
    const coinsEl = document.getElementById("go-coins");
    if(state.token && score > 0) {
        const earned = Math.floor(score / 10);
        if(coinsEl) coinsEl.innerText = `+ ${earned} 🪙`;
        await apiCall("/score", "POST", { score });
        await loadProfile();
    } else {
        if(coinsEl) coinsEl.innerText = "Modo Invitado";
    }

    const res = await apiCall("/leaderboard");
    const list = document.getElementById("leaderboard-list");
    if(list) {
        list.innerHTML = "";
        if(res.status === 200) {
            res.data.forEach((p, i) => {
                list.innerHTML += `<p>${i+1}. ${p.username} - ${p.score} pts</p>`;
            });
        }
    }
}

document.getElementById("btn-return-lobby").onclick = enterLobby;