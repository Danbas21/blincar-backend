"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLogin = exports.validateRegister = void 0;
const joi_1 = __importDefault(require("joi"));
// Schema para registro
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().messages({
        'string.email': 'Email debe tener un formato válido',
        'any.required': 'Email es requerido'
    }),
    phone: joi_1.default.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Teléfono debe tener 10 dígitos',
        'any.required': 'Teléfono es requerido'
    }),
    password: joi_1.default.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
        'string.min': 'Contraseña debe tener al menos 8 caracteres',
        'string.pattern.base': 'Contraseña debe contener al menos una mayúscula, una minúscula y un número',
        'any.required': 'Contraseña es requerida'
    }),
    firstName: joi_1.default.string().min(2).max(50).required().messages({
        'string.min': 'Nombre debe tener al menos 2 caracteres',
        'string.max': 'Nombre no puede tener más de 50 caracteres',
        'any.required': 'Nombre es requerido'
    }),
    lastName: joi_1.default.string().min(2).max(50).required().messages({
        'string.min': 'Apellido debe tener al menos 2 caracteres',
        'string.max': 'Apellido no puede tener más de 50 caracteres',
        'any.required': 'Apellido es requerido'
    }),
    role: joi_1.default.string().valid('passenger', 'driver').optional()
});
// Schema para login
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().messages({
        'string.email': 'Email debe tener un formato válido',
        'any.required': 'Email es requerido'
    }),
    password: joi_1.default.string().required().messages({
        'any.required': 'Contraseña es requerida'
    })
});
// Middleware para validar registro
const validateRegister = (req, res, next) => {
    const { error } = registerSchema.validate(req.body);
    if (error) {
        const response = {
            success: false,
            message: 'Datos inválidos',
            error: error.details[0].message,
            timestamp: new Date().toISOString()
        };
        return res.status(400).json(response);
    }
    next();
};
exports.validateRegister = validateRegister;
// Middleware para validar login
const validateLogin = (req, res, next) => {
    const { error } = loginSchema.validate(req.body);
    if (error) {
        const response = {
            success: false,
            message: 'Datos inválidos',
            error: error.details[0].message,
            timestamp: new Date().toISOString()
        };
        return res.status(400).json(response);
    }
    next();
};
exports.validateLogin = validateLogin;
