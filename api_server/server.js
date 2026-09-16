const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('./server');
const db = require('./config/db');

// 1. Secuestramos el módulo de base de datos
jest.mock('./config/db');

describe('Pruebas del Módulo de Autenticación (Galaga API)', () => {
    
    // Limpiamos la simulación antes de cada prueba
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Prueba 1: Registro exitoso
    it('Debe registrar un nuevo usuario y asignar rol', async () => {
        // Simulamos que el SELECT devuelve un array vacío (el usuario no existe)
        db.query.mockResolvedValueOnce([[]]);
        // Simulamos que el INSERT es exitoso
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

    // Prueba 2: Faltan datos en el registro
    it('Debe devolver error 400 si faltan datos en el registro', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ username: 'jugador2' }); 
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Faltan datos');
    });

    // Prueba 3: Login exitoso y generación de JWT
    it('Debe iniciar sesión correctamente y devolver un token JWT', async () => {
        // Creamos una contraseña encriptada real para que bcrypt.compare pase
        const fakeHashedPassword = await bcrypt.hash('password123', 10);
        
        // Simulamos que la DB encuentra al usuario
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

    // Prueba 4: Login con contraseña incorrecta
    it('Debe devolver error 401 si la contraseña es incorrecta', async () => {
        const fakeHashedPassword = await bcrypt.hash('password123', 10);
        
        // Simulamos que la DB encuentra al usuario, pero mandaremos un password erróneo en el request
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