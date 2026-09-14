const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Secreto para firmar los JWT 
const JWT_SECRET = "galaga_super_secret_key_123";

// Base de datos simulada en memoria (después la conectare a MySQL)
const usersDB = [];

// Ruta de estado para verificar que el servidor está activo
app.get('/', (req, res) => {
    res.status(200).json({ status: "ok", message: "API de Galaga operativa" });
});

// 1. Endpoint para Registrar Usuarios
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    // Hashear la contraseña por seguridad
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Asignar rol (por defecto 'usuario', pero permitimos 'admin' para pruebas)
    const userRole = role === 'admin' ? 'admin' : 'usuario';

    const newUser = {
        id: usersDB.length + 1,
        username,
        password: hashedPassword,
        role: userRole,
        coins: 0 // Saldo inicial para la tienda
    };

    usersDB.push(newUser);
    res.status(201).json({ message: "Usuario registrado con éxito", role: userRole });
});

// 2. Endpoint para Iniciar Sesión (Genera el JWT)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const user = usersDB.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Validar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Generar Token JWT incluyendo el rol
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({ message: "Login exitoso", token });
});

// Arrancar el servidor
const PORT = 3000;
if (require.main === module) {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Servidor API de Galaga corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;