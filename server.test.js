const request = require('supertest');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Evita que dotenv lea el .env real del disco durante las pruebas. Sin esto,
// al borrar process.env.JWT_SECRET para probar el arranque fallido, dotenv
// lo volvía a cargar desde el archivo .env real y el test nunca veía el error.
jest.mock('dotenv', () => ({ config: jest.fn() }));

// 0. server.js ahora exige JWT_SECRET en el entorno (falla rápido si falta).
//    Debe definirse ANTES de requerir './server'.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_solo_para_pruebas';
// Definimos un origen permitido para poder probar también el rechazo de CORS.
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'https://origen-permitido.com';

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

// 4. Token de administrador para probar las rutas /api/admin/*
const adminToken = jwt.sign(
    { id: 99, username: 'admin_prueba', role: 'admin' },
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

    // --- VALIDACIONES NUEVAS (registro / login) ---
    it('Debería rechazar un usuario con formato inválido (400)', async () => {
        const res = await request(app).post('/api/register').send({ username: 'ab', password: 'Piloto123' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería rechazar una contraseña demasiado corta (400)', async () => {
        const res = await request(app).post('/api/register').send({ username: 'piloto2', password: '123' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería devolver 500 si falla la base de datos al registrar', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).post('/api/register').send({ username: 'piloto3', password: 'Piloto123' });
        expect(res.statusCode).toBe(500);
    });

    it('Debería rechazar login sin usuario o contraseña (400)', async () => {
        const res = await request(app).post('/api/login').send({ username: 'piloto' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería devolver 500 si falla la base de datos al iniciar sesión', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).post('/api/login').send({ username: 'piloto', password: 'Piloto123' });
        expect(res.statusCode).toBe(500);
    });

    // --- CATCHES DE ERROR EN RUTAS PROTEGIDAS ---
    it('Debería devolver 500 si falla la base de datos al guardar puntuación', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).post('/api/score').set('Authorization', `Bearer ${validToken}`).send({ score: 100 });
        expect(res.statusCode).toBe(500);
    });

    it('Debería devolver 500 si falla la base de datos al obtener el perfil', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).get('/api/me').set('Authorization', `Bearer ${validToken}`);
        expect(res.statusCode).toBe(500);
    });

    it('Debería devolver 500 si falla la base de datos en la tienda', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).post('/api/shop').set('Authorization', `Bearer ${validToken}`).send({ skin_name: 'skin_neon', cost: 100 });
        expect(res.statusCode).toBe(500);
    });

    it('Debería devolver 500 si falla la base de datos al equipar', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).post('/api/equip').set('Authorization', `Bearer ${validToken}`).send({ skin_name: 'skin_neon' });
        expect(res.statusCode).toBe(500);
    });

    it('Debería devolver 500 si falla la base de datos en el leaderboard', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).get('/api/leaderboard');
        expect(res.statusCode).toBe(500);
    });

    // --- RUTAS DE ADMINISTRADOR ---
    it('Debería denegar rutas de admin a un usuario sin rol admin (403)', async () => {
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${validToken}`);
        expect(res.statusCode).toBe(403);
    });

    it('Debería listar usuarios para un administrador (200)', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, username: 'piloto', role: 'usuario', coins: 50 }]]);
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('Debería devolver 500 si falla la base de datos listando usuarios (admin)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(500);
    });

    it('Debería actualizar un usuario correctamente (admin) (200)', async () => {
        pool.execute.mockResolvedValueOnce([]);
        const res = await request(app).put('/api/admin/users/5').set('Authorization', `Bearer ${adminToken}`).send({ role: 'admin', coins: 200 });
        expect(res.statusCode).toBe(200);
    });

    it('Debería rechazar un rol inválido al actualizar usuario (400)', async () => {
        const res = await request(app).put('/api/admin/users/5').set('Authorization', `Bearer ${adminToken}`).send({ role: 'superadmin' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería rechazar un valor de monedas inválido al actualizar usuario (400)', async () => {
        const res = await request(app).put('/api/admin/users/5').set('Authorization', `Bearer ${adminToken}`).send({ coins: -10 });
        expect(res.statusCode).toBe(400);
    });

    it('Debería impedir que un admin se quite su propio rol (400)', async () => {
        const res = await request(app).put('/api/admin/users/99').set('Authorization', `Bearer ${adminToken}`).send({ role: 'usuario' });
        expect(res.statusCode).toBe(400);
    });

    it('Debería devolver 500 si falla la base de datos al actualizar usuario (admin)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).put('/api/admin/users/5').set('Authorization', `Bearer ${adminToken}`).send({ role: 'admin', coins: 50 });
        expect(res.statusCode).toBe(500);
    });

    it('Debería eliminar un usuario correctamente (admin) (200)', async () => {
        pool.execute.mockResolvedValueOnce([]);
        const res = await request(app).delete('/api/admin/users/5').set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(200);
    });

    it('Debería impedir que un admin se elimine a sí mismo (400)', async () => {
        const res = await request(app).delete('/api/admin/users/99').set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(400);
    });

    it('Debería devolver 500 si falla la base de datos al eliminar usuario (admin)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Fallo de conexión'));
        const res = await request(app).delete('/api/admin/users/5').set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(500);
    });

    // --- CORS Y ARCHIVOS ESTÁTICOS ---
    it('Debería rechazar peticiones desde un origen no permitido (CORS)', async () => {
        const res = await request(app).get('/api/leaderboard').set('Origin', 'https://origen-no-permitido.com');
        expect(res.statusCode).toBe(500);
    });

    it('Debería aplicar cabeceras anti-caché a los archivos estáticos', async () => {
        const res = await request(app).get('/style.css');
        expect(res.headers['cache-control']).toContain('no-store');
    });

    it('Debería servir index.html para rutas no definidas (catch-all)', async () => {
        const res = await request(app).get('/ruta-que-no-existe-xyz');
        expect(res.statusCode).toBe(200);
    });
});

// --- CONFIGURACIÓN CRÍTICA ---
describe('Arranque del servidor', () => {
    it('Debería fallar al iniciar si JWT_SECRET no está definido', () => {
        const originalSecret = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        jest.resetModules();
        // Sin esto, dotenv volvería a cargar JWT_SECRET desde el .env real
        // del proyecto al re-ejecutar server.js, y la prueba no tendría sentido.
        jest.doMock('dotenv', () => ({ config: () => {} }));
        expect(() => require('./server')).toThrow('JWT_SECRET');
        jest.dontMock('dotenv');
        process.env.JWT_SECRET = originalSecret;
        jest.resetModules();
    });
});