const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

// --- Falla rápido si falta configuración crítica de seguridad ---
// Un secreto JWT hardcodeado permite forjar tokens válidos si el atacante
// conoce (o adivina) el valor por defecto. Nunca debe existir un fallback.
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno. La aplicación no puede iniciar sin él.');
}
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const PORT = process.env.PORT || 3000;

// Oculta la cabecera "X-Powered-By: Express" (fuga de información de stack tecnológico)
app.disable('x-powered-by');

// Cabeceras de seguridad estándar (X-Frame-Options, X-Content-Type-Options,
// Strict-Transport-Security, etc.), con una Content-Security-Policy explícita
// en vez del preset por defecto: el preset de helmet incluye "https:" como
// fuente comodín en style-src/font-src (alerta ZAP "CSP: Wildcard Directive")
// y 'unsafe-inline' en style-src (alerta ZAP "CSP: style-src unsafe-inline").
// Como index.html ya no usa atributos style="..." inline, no necesitamos
// 'unsafe-inline' en absoluto. Se permite explícitamente Google Fonts porque
// style.css lo carga vía @import.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: []
        }
    }
}));

// CORS restringido a una lista blanca de orígenes en lugar de "*"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Permite herramientas sin origin (curl, apps móviles) y orígenes en whitelist
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('No permitido por CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100kb' })); // límite para mitigar payloads abusivos

// Rate limiting en rutas de autenticación para mitigar fuerza bruta / credential stuffing
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // máximo 10 intentos por IP en la ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' }
});

// Bloqueo estricto de caché para evitar que el navegador guarde versiones viejas
app.use(express.static(path.join(__dirname, 'public'), { 
    acceptRanges: false,
    etag: false,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Expires', '-1');
        res.set('Pragma', 'no-cache');
    }
}));

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
};
const pool = mysql.createPool(dbConfig);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ error: 'Acceso denegado.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido.' });
        req.user = user; 
        next(); 
    });
};

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador.' });
    next();
};

// Solo se aceptan letras/números/guion-bajo, entre 3 y 20 caracteres, para evitar
// entradas anómalas y reducir superficie de ataque (p.ej. bypass de reglas, payloads raros).
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

app.post('/api/register', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos.' });
        if (!USERNAME_REGEX.test(username)) {
            return res.status(400).json({ error: 'El usuario debe tener entre 3 y 20 caracteres alfanuméricos.' });
        }
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        // El rol nunca se toma del body: siempre se crea como 'usuario' por defecto,
        // evitando que un cliente se auto-asigne el rol de administrador.
        await pool.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'usuario']);
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
        res.status(500).json({ error: 'Error interno.' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos.' });
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        // Mensaje genérico: no revelar si el usuario existe o no (evita enumeración de cuentas)
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        const validPassword = await bcrypt.compare(password, rows[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        const token = jwt.sign({ id: rows[0].id, username: rows[0].username, role: rows[0].role || 'usuario' }, JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ token, message: 'Autenticación exitosa.' });
    } catch (error) {
        res.status(500).json({ error: 'Error interno.' });
    }
});

app.post('/api/score', authenticateToken, async (req, res) => {
    try {
        const { score } = req.body;
        const earnedCoins = Math.floor(score / 10);
        await pool.execute('INSERT INTO scores (user_id, score) VALUES (?, ?)', [req.user.id, score]);
        await pool.execute('UPDATE users SET coins = coins + ? WHERE id = ?', [earnedCoins, req.user.id]);
        res.status(201).json({ message: 'Guardado.', earnedCoins });
    } catch (error) {
        res.status(500).json({ error: 'Error interno.' });
    }
});

app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT username, coins, current_skin, owned_skins, role FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

app.post('/api/shop', authenticateToken, async (req, res) => {
    try {
        const { skin_name, cost } = req.body;
        const userId = req.user.id;
        const [rows] = await pool.execute('SELECT coins, owned_skins FROM users WHERE id = ?', [userId]);
        const user = rows[0];
        
        const ownedArray = user.owned_skins.split(',');
        if (ownedArray.includes(skin_name)) return res.status(400).json({ error: 'Ya posees esta skin.' });
        if (user.coins < cost) return res.status(400).json({ error: 'Monedas insuficientes.' });

        ownedArray.push(skin_name);
        await pool.execute('UPDATE users SET coins = coins - ?, current_skin = ?, owned_skins = ? WHERE id = ?', 
            [cost, skin_name, ownedArray.join(','), userId]);
        
        res.status(200).json({ message: 'Compra exitosa.' });
    } catch (error) {
        res.status(500).json({ error: 'Error en transacción.' });
    }
});

app.post('/api/equip', authenticateToken, async (req, res) => {
    try {
        const { skin_name } = req.body;
        const [rows] = await pool.execute('SELECT owned_skins FROM users WHERE id = ?', [req.user.id]);
        if (!rows[0].owned_skins.split(',').includes(skin_name)) return res.status(403).json({ error: 'No posees esta skin.' });
        
        await pool.execute('UPDATE users SET current_skin = ? WHERE id = ?', [skin_name, req.user.id]);
        res.status(200).json({ message: 'Skin equipada.' });
    } catch (error) {
        res.status(500).json({ error: 'Error interno.' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT u.username, s.score FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.score DESC LIMIT 5');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error.' });
    }
});

// --- RUTAS CRUD PARA ADMINISTRADORES ---
app.get('/api/admin/users', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, username, role, coins FROM users');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Error del servidor.' }); }
});

// Único conjunto de roles válidos en el sistema. Cualquier otro valor se rechaza
// para evitar que se inyecten roles arbitrarios (escalado de privilegios).
const VALID_ROLES = ['usuario', 'admin'];

app.put('/api/admin/users/:id', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { role, coins } = req.body;
        const targetId = Number(req.params.id);

        if (role !== undefined && !VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}.` });
        }
        if (coins !== undefined && (!Number.isFinite(Number(coins)) || Number(coins) < 0)) {
            return res.status(400).json({ error: 'El valor de monedas es inválido.' });
        }
        // Evita que un administrador se quite a sí mismo el rol de admin por error,
        // lo que podría dejar el sistema sin ningún administrador.
        if (targetId === req.user.id && role !== undefined && role !== 'admin') {
            return res.status(400).json({ error: 'No puedes cambiar tu propio rol de administrador.' });
        }

        await pool.execute('UPDATE users SET role = ?, coins = ? WHERE id = ?', [role, coins, targetId]);
        res.json({ message: 'Usuario actualizado.' });
    } catch (error) { res.status(500).json({ error: 'Error al actualizar.' }); }
});

app.delete('/api/admin/users/:id', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        // Evita que un administrador se elimine a sí mismo por accidente
        if (targetId === req.user.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
        }
        await pool.execute('DELETE FROM users WHERE id = ?', [targetId]);
        res.json({ message: 'Usuario eliminado.' });
    } catch (error) { res.status(500).json({ error: 'Error al eliminar.' }); }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 API y Servidor Web funcionando en el puerto ${PORT}`));
}
module.exports = app;