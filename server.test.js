const request = require('supertest');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// 0. server.js ahora exige JWT_SECRET en el entorno (falla rápido si falta).
//    Debe definirse ANTES de requerir './server'.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_solo_para_pruebas';

// 1. Simulamos la conexión a la base de datos
jest.mock('mysql2/promise', () => {
    const mPool = { execute: jest.fn() };
    return { createPool: jest.fn(() => mPool) };
});

// 2. Importamos tu aplicación
const app = require('./server');
const pool = mysql.createPool();

// 3. Generamos un token válido para probar las rutas protegidas
const validToken = jwt.sign(
    { id: 1, username: 'piloto_prueba', role: 'usuario' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
);

describe('Pruebas de Integración y Cobertura (Galaga SaaS)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- RUTAS PÚBLICAS ---
    it('Debería registrar un usuario correctamente (201)', async () => {
        pool.execute.mockResolvedValueOnce([[]]); 
        const res = await request(app).post('/api/register').send({ username: 'piloto', password: 'Piloto123' });
        expect(res.statusCode).toBe(201);
    });

    it('Debería rechazar registro sin datos completos (400)', async () => {
        const res = await request(app).post('/api/register').send({ username: 'piloto' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería rechazar registro de usuario duplicado (400)', async () => {
        const error = new Error('Duplicate'); error.code = 'ER_DUP_ENTRY';
        pool.execute.mockRejectedValueOnce(error);
        const res = await request(app).post('/api/register').send({ username: 'piloto', password: 'Piloto123' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería iniciar sesión correctamente (200)', async () => {
        const hash = await bcrypt.hash('Piloto123', 10);
        pool.execute.mockResolvedValueOnce([[{ id: 1, username: 'piloto', password: hash, role: 'usuario' }]]);
        const res = await request(app).post('/api/login').send({ username: 'piloto', password: 'Piloto123' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    it('Debería rechazar login con contraseña incorrecta (401)', async () => {
        const hash = await bcrypt.hash('Piloto123', 10);
        pool.execute.mockResolvedValueOnce([[{ id: 1, username: 'piloto', password: hash }]]);
        const res = await request(app).post('/api/login').send({ username: 'piloto', password: 'Incorrecta1' });
        expect(res.statusCode).toBe(401);
    });

    it('Debería retornar el leaderboard (200)', async () => {
        pool.execute.mockResolvedValueOnce([[{ username: 'Piloto1', score: 100 }]]);
        const res = await request(app).get('/api/leaderboard');
        expect(res.statusCode).toBe(200);
    });

    // --- SEGURIDAD Y JWT (MIDDLEWARE) ---
    it('Debería denegar el acceso sin Token (401)', async () => {
        const res = await request(app).get('/api/me');
        expect(res.statusCode).toBe(401);
    });

    it('Debería denegar el acceso con un Token inválido o alterado (403)', async () => {
        const res = await request(app).get('/api/me').set('Authorization', 'Bearer token_falso_123');
        expect(res.statusCode).toBe(403);
    });

    // --- RUTAS PROTEGIDAS (TIENDA, SCORE, LOBBY) ---
    it('Debería obtener el perfil del usuario autenticado (200)', async () => {
        pool.execute.mockResolvedValueOnce([[{ username: 'piloto', coins: 100, current_skin: 'base', owned_skins: 'base' }]]);
        const res = await request(app).get('/api/me').set('Authorization', `Bearer ${validToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.username).toBe('piloto');
    });

    it('Debería guardar la puntuación y otorgar monedas (201)', async () => {
        pool.execute.mockResolvedValueOnce([]); // Mock INSERT score
        pool.execute.mockResolvedValueOnce([]); // Mock UPDATE coins
        const res = await request(app).post('/api/score').set('Authorization', `Bearer ${validToken}`).send({ score: 150 });
        expect(res.statusCode).toBe(201);
        expect(res.body.earnedCoins).toBe(15);
    });

    it('Debería procesar compra en la tienda exitosamente (200)', async () => {
        pool.execute.mockResolvedValueOnce([[{ coins: 5000, owned_skins: 'player_default' }]]); // Mock saldo suficiente
        pool.execute.mockResolvedValueOnce([]); // Mock UPDATE compra
        const res = await request(app).post('/api/shop').set('Authorization', `Bearer ${validToken}`).send({ skin_name: 'skin_neon', cost: 3000 });
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Compra exitosa.');
    });

    it('Debería rechazar compra por falta de monedas (400)', async () => {
        pool.execute.mockResolvedValueOnce([[{ coins: 0, owned_skins: 'player_default' }]]); // Mock sin dinero
        const res = await request(app).post('/api/shop').set('Authorization', `Bearer ${validToken}`).send({ skin_name: 'skin_neon', cost: 3000 });
        expect(res.statusCode).toBe(400);
    });

    it('Debería equipar una skin del locker (200)', async () => {
        pool.execute.mockResolvedValueOnce([[{ owned_skins: 'player_default,skin_neon' }]]); // Mock skin ya comprada
        pool.execute.mockResolvedValueOnce([]); // Mock UPDATE current_skin
        const res = await request(app).post('/api/equip').set('Authorization', `Bearer ${validToken}`).send({ skin_name: 'skin_neon' });
        expect(res.statusCode).toBe(200);
    });
});