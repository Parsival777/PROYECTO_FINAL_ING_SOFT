const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json());

// --- CONEXIÓN A TiDB CLOUD ---
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
};

const pool = mysql.createPool(dbConfig);

// --- MIDDLEWARE DE SEGURIDAD JWT ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_galaga', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
        req.user = user; 
        next(); 
    });
};

// --- RUTAS DE LA API RESTful ---

// 1. REGISTRO DE USUARIO
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );
        
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error('Error en registro:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// 2. INICIO DE SESIÓN
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado.' });
        
        const user = rows[0];
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta.' });
        
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'secreto_super_seguro_galaga',
            { expiresIn: '24h' }
        );
        
        res.status(200).json({ token, message: 'Autenticación exitosa.' });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// 3. GUARDAR PUNTUACIÓN Y SUMAR MONEDAS
app.post('/api/score', authenticateToken, async (req, res) => {
    try {
        const { score } = req.body;
        const userId = req.user.id; 
        
        // Conversión: 10 puntos = 1 moneda
        const earnedCoins = Math.floor(score / 10);

        await pool.execute('INSERT INTO scores (user_id, score) VALUES (?, ?)', [userId, score]);
        await pool.execute('UPDATE users SET coins = coins + ? WHERE id = ?', [earnedCoins, userId]);
        
        res.status(201).json({ message: 'Puntuación y monedas guardadas.', earnedCoins });
    } catch (error) {
        console.error('Error al guardar puntuación:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// 4. CONSULTAR PERFIL (Billetera y Skin actual)
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT username, coins, current_skin FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

// 5. TIENDA: COMPRAR Y EQUIPAR SKIN
app.post('/api/shop', authenticateToken, async (req, res) => {
    try {
        const { skin_name, cost } = req.body;
        const userId = req.user.id;

        const [rows] = await pool.execute('SELECT coins FROM users WHERE id = ?', [userId]);
        const userCoins = rows[0].coins;

        if (userCoins < cost) {
            return res.status(400).json({ error: 'Monedas insuficientes.' });
        }

        await pool.execute('UPDATE users SET coins = coins - ?, current_skin = ? WHERE id = ?', [cost, skin_name, userId]);
        
        res.status(200).json({ message: 'Compra exitosa. Skin equipada.' });
    } catch (error) {
        console.error('Error en la tienda:', error);
        res.status(500).json({ error: 'Error en la transacción.' });
    }
});

// 6. TABLA DE CLASIFICACIÓN
app.get('/api/leaderboard', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT u.username, s.score 
            FROM scores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.score DESC
            LIMIT 5
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener leaderboard:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 API Server funcionando en el puerto ${PORT}`);
});