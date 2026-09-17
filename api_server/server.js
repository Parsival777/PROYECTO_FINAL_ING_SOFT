const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const db = require('./config/db');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = 'SECRET_KEY'; // Debe ser la misma clave que usas en el resto del proyecto

// Ruta de estado (Health Check)
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Registro de usuarios
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(409).json({ error: 'El usuario ya existe' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'usuario']);
        res.status(201).json({ message: 'Usuario registrado con éxito', role: 'usuario' });
    } catch (error) {
        res.status(500).json({ error: 'Error en base de datos' });
    }
});

// Inicio de sesión
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '2h' });
        res.status(200).json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Error en base de datos' });
    }
});

// ==========================================
// NUEVO: SISTEMA DE PUNTUACIONES
// ==========================================

// Middleware para verificar el Token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // El formato es "Bearer <token>"
    
    if (!token) return res.status(401).json({ error: 'Acceso denegado, token requerido' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = user; 
        next(); 
    });
};

// Ruta para guardar la puntuación (Requiere Token)
app.post('/api/score', authenticateToken, async (req, res) => {
    const { score } = req.body;
    if (score === undefined) return res.status(400).json({ error: 'Falta la puntuación' });

    try {
        await db.query('INSERT INTO scores (user_id, score) VALUES (?, ?)', [req.user.id, score]);
        res.status(201).json({ message: 'Puntuación guardada con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en base de datos' });
    }
});

// Ruta para obtener el Top 10 (Leaderboard) - Pública
app.get('/api/leaderboard', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.username, s.score, DATE_FORMAT(s.created_at, '%d/%m/%Y') as fecha
            FROM scores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.score DESC
            LIMIT 10
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener leaderboard' });
    }
});

// Inicialización del servidor
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor API de Galaga corriendo en http://localhost:3000 ${PORT}`);
    });
}

module.exports = app;