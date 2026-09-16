const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('./server');
const db = require('./config/db');

// Mock del módulo de base de datos
jest.mock('./config/db');

describe('Pruebas del Módulo de Autenticación (Galaga API)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Health check (Línea 16)
    it('Debe responder 200 en la ruta raíz de estado', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status', 'ok');
    });

    // Registro exitoso
    it('Debe registrar un nuevo usuario y asignar rol', async () => {
        db.query.mockResolvedValueOnce([[]]);
        db.query.mockResolvedValueOnce([{ insertId: 1 }]);

        const res = await request(app)
            .post('/api/register')
            .send({
                username: 'jugador1',
                password: 'password123'
            });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('message', 'Usuario registrado con éxito');
        expect(res.body).toHaveProperty('role', 'usuario');
    });

    // Faltan datos en el registro
    it('Debe devolver error 400 si faltan datos en el registro', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ username: 'jugador2' }); 
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Faltan datos');
    });

    // Usuario duplicado en registro (Línea 29)
    it('Debe devolver 409 si el usuario ya existe', async () => {
        db.query.mockResolvedValueOnce([[{ id: 1, username: 'jugador1' }]]);

        const res = await request(app)
            .post('/api/register')
            .send({
                username: 'jugador1',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(409);
        expect(res.body).toHaveProperty('error', 'El usuario ya existe');
    });

    // Error de base de datos en registro (Línea 41)
    it('Debe devolver 500 si la base de datos falla en el registro', async () => {
        db.query.mockRejectedValueOnce(new Error('Fallo de conexión'));

        const res = await request(app)
            .post('/api/register')
            .send({
                username: 'jugador1',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Error en base de datos');
    });

    // Faltan datos en login (Línea 49)
    it('Debe devolver error 400 si faltan datos en el login', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'jugador1' });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Faltan datos');
    });

    // Usuario no existe en login (Línea 55)
    it('Debe devolver 401 si el usuario no existe', async () => {
        db.query.mockResolvedValueOnce([[]]);

        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'noexiste',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Credenciales inválidas');
    });

    // Login exitoso
    it('Debe iniciar sesión correctamente y devolver un token JWT', async () => {
        const fakeHashedPassword = await bcrypt.hash('password123', 10);
        
        db.query.mockResolvedValueOnce([[{ 
            id: 1, 
            username: 'jugador1', 
            password: fakeHashedPassword, 
            role: 'usuario' 
        }]]);

        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'jugador1',
                password: 'password123'
            });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('role', 'usuario');
    });

    // Password incorrecto en login
    it('Debe devolver error 401 si la contraseña es incorrecta', async () => {
        const fakeHashedPassword = await bcrypt.hash('password123', 10);
        
        db.query.mockResolvedValueOnce([[{ 
            id: 1, 
            username: 'jugador1', 
            password: fakeHashedPassword, 
            role: 'usuario' 
        }]]);

        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'jugador1',
                password: 'wrongpassword'
            });
        
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Credenciales inválidas');
    });

    // Error de base de datos en login (Línea 72)
    it('Debe devolver 500 si la base de datos falla en el login', async () => {
        db.query.mockRejectedValueOnce(new Error('Fallo de conexión'));

        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'jugador1',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Error en base de datos');
    });
});