"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
class AuthController {
    // Registro de usuario
    static async register(req, res) {
        const { email, phone, password, firstName, lastName, role = 'passenger', emergencyContactName, emergencyContactPhone } = req.body;
        try {
            // Verificar si el usuario ya existe
            const existingUser = await database_1.pool.query('SELECT id FROM users WHERE email = $1 OR phone = $2', [email, phone]);
            if (existingUser.rows.length > 0) {
                const response = {
                    success: false,
                    message: 'El email o teléfono ya están registrados',
                    timestamp: new Date().toISOString()
                };
                return res.status(400).json(response);
            }
            // Encriptar contraseña
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
            // Insertar usuario
            const userResult = await database_1.pool.query(`INSERT INTO users (email, phone, password, first_name, last_name, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         RETURNING id, email, phone, first_name, last_name, role, created_at`, [email, phone, hashedPassword, firstName, lastName, role, emergencyContactName, emergencyContactPhone]);
            const user = userResult.rows[0];
            // Generar JWT
            const token = jsonwebtoken_1.default.sign({
                id: user.id,
                email: user.email,
                role: user.role
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' });
            const response = {
                success: true,
                message: 'Usuario registrado exitosamente',
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        phone: user.phone,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        role: user.role,
                        createdAt: user.created_at
                    }
                },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error en registro:', error);
            const response = {
                success: false,
                message: 'Error interno del servidor',
                error: error instanceof Error ? error.message : 'Error desconocido',
                timestamp: new Date().toISOString()
            };
            res.status(500).json(response);
        }
    }
    // Login de usuario
    static async login(req, res) {
        const { email, password } = req.body;
        try {
            // Buscar usuario
            const userResult = await database_1.pool.query('SELECT id, email, phone, password, first_name, last_name, role, status FROM users WHERE email = $1', [email]);
            if (userResult.rows.length === 0) {
                const response = {
                    success: false,
                    message: 'Credenciales inválidas',
                    timestamp: new Date().toISOString()
                };
                return res.status(401).json(response);
            }
            const user = userResult.rows[0];
            // Verificar contraseña
            const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
            if (!isValidPassword) {
                const response = {
                    success: false,
                    message: 'Credenciales inválidas',
                    timestamp: new Date().toISOString()
                };
                return res.status(401).json(response);
            }
            // Verificar estado del usuario
            if (user.status !== 'active') {
                const response = {
                    success: false,
                    message: 'Cuenta suspendida o inactiva',
                    timestamp: new Date().toISOString()
                };
                return res.status(401).json(response);
            }
            // Generar JWT
            const token = jsonwebtoken_1.default.sign({
                id: user.id,
                email: user.email,
                role: user.role
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '24h' });
            // Actualizar último login
            await database_1.pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
            const response = {
                success: true,
                message: 'Login exitoso',
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        phone: user.phone,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        role: user.role
                    }
                },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error en login:', error);
            const response = {
                success: false,
                message: 'Error interno del servidor',
                error: error instanceof Error ? error.message : 'Error desconocido',
                timestamp: new Date().toISOString()
            };
            res.status(500).json(response);
        }
    }
    // Verificar token
    static async verifyToken(req, res) {
        try {
            const response = {
                success: true,
                message: 'Token válido',
                data: {
                    user: req.user
                },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error verificando token:', error);
            const response = {
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            };
            res.status(500).json(response);
        }
    }
    // Logout (invalidar token - placeholder por ahora)
    static async logout(req, res) {
        try {
            // TODO: Implementar blacklist de tokens en Redis
            const response = {
                success: true,
                message: 'Logout exitoso',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error en logout:', error);
            const response = {
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            };
            res.status(500).json(response);
        }
    }
}
exports.AuthController = AuthController;
