const request = require('supertest');
const app = require('./server');

describe('Pruebas del Módulo de Autenticación (Galaga API)', () => {
    
    // Prueba 1: Registro exitoso
    it('Debe registrar un nuevo usuario y asignar rol', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({
                username: 'jugador1',
                password: 'password123',
                role: 'usuario'
            });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('message', 'Usuario registrado con éxito');
        expect(res.body).toHaveProperty('role', 'usuario');
    });

    // Prueba 2: Faltan datos en el registro
    it('Debe devolver error 400 si faltan datos en el registro', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ username: 'jugador2' }); // Falta el password
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Faltan datos');
    });

    // Prueba 3: Login exitoso y generación de JWT
    it('Debe iniciar sesión correctamente y devolver un token JWT', async () => {
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