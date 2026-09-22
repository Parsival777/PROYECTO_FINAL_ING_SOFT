const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json());

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
    jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_galaga', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido.' });
        req.user = user; 
        next(); 
    });
};

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador.' });
    next();
};

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Faltan datos.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
        res.status(500).json({ error: 'Error interno.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado.' });
        const validPassword = await bcrypt.compare(password, rows[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta.' });
        const token = jwt.sign({ id: rows[0].id, username: rows[0].username, role: rows[0].role || 'usuario' }, process.env.JWT_SECRET || 'secreto_super_seguro_galaga', { expiresIn: '24h' });
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

app.put('/api/admin/users/:id', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const { role, coins } = req.body;
        await pool.execute('UPDATE users SET role = ?, coins = ? WHERE id = ?', [role, coins, req.params.id]);
        res.json({ message: 'Usuario actualizado.' });
    } catch (error) { res.status(500).json({ error: 'Error al actualizar.' }); }
});

app.delete('/api/admin/users/:id', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
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