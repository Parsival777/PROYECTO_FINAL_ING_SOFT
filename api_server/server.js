const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
// ¡CORS habilitado! Permite que tu GitHub Pages se comunique con Render
app.use(cors()); 
app.use(express.json());

// --- CONEXIÓN A TiDB CLOUD (MYSQL) ---
// Extrae las credenciales de las variables de entorno de Render
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 4000,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // TiDB Cloud exige conexiones seguras (SSL)
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
};

const pool = mysql.createPool(dbConfig);

// --- MIDDLEWARE DE SEGURIDAD JWT ---
// Protege las rutas para que solo los usuarios logueados puedan guardar puntajes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extrae el token del formato "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_galaga', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
        req.user = user; 
        next(); // El token es válido, continúa a la ruta solicitada
    });
};

// --- RUTAS DE LA API RESTful ---

// 1. REGISTRO DE USUARIO (Crear cuenta)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos.' });

        // Encriptar la contraseña por seguridad
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

// 2. INICIO DE SESIÓN (Login)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Buscar el usuario en la base de datos
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado.' });
        
        const user = rows[0];
        
        // Verificar que la contraseña coincida con el hash
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta.' });
        
        // Generar Token JWT válido por 24 horas
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

// 3. GUARDAR PUNTUACIÓN (Ruta protegida)
app.post('/api/score', authenticateToken, async (req, res) => {
    try {
        const { score } = req.body;
        const userId = req.user.id; // Lo obtiene del token validado
        
        await pool.execute(
            'INSERT INTO scores (user_id, score) VALUES (?, ?)',
            [userId, score]
        );
        
        res.status(201).json({ message: 'Puntuación guardada exitosamente.' });
    } catch (error) {
        console.error('Error al guardar puntuación:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// 4. TABLA DE CLASIFICACIÓN (Leaderboard)
app.get('/api/leaderboard', async (req, res) => {
    try {
        // Hace un JOIN (unión) entre la tabla de usuarios y puntuaciones para traer los mejores 5
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

// --- INICIALIZACIÓN DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 API Server funcionando en el puerto ${PORT}`);
});