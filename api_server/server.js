const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'galaga_secret_key_2026';

// Ruta de estado para escaneos y monitoreo
app.get('/', (req, res) => {
    res.status(200).json({ status: "ok", message: "API de Galaga operativa" });
});

// Registro con persistencia en MySQL
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    try {
        const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: "El usuario ya existe" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [
            username,
            hashedPassword,
            'usuario'
        ]);

        return res.status(201).json({ message: "Usuario registrado con éxito", role: "usuario" });
    } catch (err) {
        return res.status(500).json({ error: "Error en base de datos", details: err.message });
    }
});

// Login con validación contra MySQL
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        return res.status(200).json({ message: "Login exitoso", token, role: user.role });
    } catch (err) {
        return res.status(500).json({ error: "Error en base de datos", details: err.message });
    }
});

if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor API de Galaga corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;