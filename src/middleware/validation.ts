 
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types';

// Schema para registro
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email debe tener un formato válido',
    'any.required': 'Email es requerido'
  }),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Teléfono debe tener 10 dígitos',
    'any.required': 'Teléfono es requerido'
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Contraseña debe tener al menos 8 caracteres',
    'string.pattern.base': 'Contraseña debe contener al menos una mayúscula, una minúscula y un número',
    'any.required': 'Contraseña es requerida'
  }),
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'string.max': 'Nombre no puede tener más de 50 caracteres',
    'any.required': 'Nombre es requerido'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Apellido debe tener al menos 2 caracteres',
    'string.max': 'Apellido no puede tener más de 50 caracteres',
    'any.required': 'Apellido es requerido'
  }),
  role: Joi.string().valid('passenger', 'driver').optional()
});

// Schema para login
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email debe tener un formato válido',
    'any.required': 'Email es requerido'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Contraseña es requerida'
  })
});

// Middleware para validar registro
export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { error } = registerSchema.validate(req.body);

  if (error) {
    const response: ApiResponse = {
      success: false,
      message: 'Datos inválidos',
      error: error.details[0].message,
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(response);
  }

  next();
};

// Middleware para validar login
export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const { error } = loginSchema.validate(req.body);

  if (error) {
    const response: ApiResponse = {
      success: false,
      message: 'Datos inválidos',
      error: error.details[0].message,
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(response);
  }

  next();
};