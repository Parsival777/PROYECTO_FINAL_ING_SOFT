const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('./server');
const db = require('./config/db');

// Secuestramos la base de datos
jest.mock('./config/db');

describe('Pruebas del Módulo de Autenticación (Galaga API)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

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

    it('Debe devolver error 400 si faltan datos en el registro', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ username: 'jugador2' }); 
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Faltan datos');
    });

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
    });

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
});