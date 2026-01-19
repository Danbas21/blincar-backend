import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as admin from 'firebase-admin';
import { pool } from '../config/database';

// Inicializar Firebase Admin si no esta inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

// Extender la interfaz Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    // Primero intentar verificar como Firebase ID Token
    try {
      const decodedFirebase = await admin.auth().verifyIdToken(token);

      // Buscar o crear usuario en la base de datos por firebase_uid
      let userResult = await pool.query(
        'SELECT id, email, role, status, firebase_uid FROM users WHERE firebase_uid = $1',
        [decodedFirebase.uid]
      );

      // Si no existe, buscar por email
      if (userResult.rows.length === 0) {
        userResult = await pool.query(
          'SELECT id, email, role, status, firebase_uid FROM users WHERE email = $1',
          [decodedFirebase.email]
        );

        // Si encontramos por email, actualizar firebase_uid
        if (userResult.rows.length > 0) {
          await pool.query(
            'UPDATE users SET firebase_uid = $1 WHERE email = $2',
            [decodedFirebase.uid, decodedFirebase.email]
          );
        }
      }

      // Si aun no existe, crear usuario
      if (userResult.rows.length === 0) {
        const insertResult = await pool.query(
          `INSERT INTO users (email, firebase_uid, role, status, created_at)
           VALUES ($1, $2, 'passenger', 'active', NOW())
           RETURNING id, email, role, status, firebase_uid`,
          [decodedFirebase.email, decodedFirebase.uid]
        );
        userResult = insertResult;
      }

      const user = userResult.rows[0];

      // Verificar que el usuario esta activo
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Cuenta suspendida o inactiva'
        });
      }

      // Agregar user al request
      req.user = user;
      return next();

    } catch (firebaseError) {
      // Si falla Firebase, intentar con JWT regular
      console.log('Firebase token failed, trying JWT...');
    }

    // Intentar verificar como JWT regular
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JWTPayload;

    // Verificar que el usuario existe en la base de datos
    const userResult = await pool.query(
      'SELECT id, email, role, status FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no valido'
      });
    }

    const user = userResult.rows[0];

    // Verificar que el usuario esta activo
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Cuenta suspendida o inactiva'
      });
    }

    // Agregar user al request
    req.user = user;
    next();

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Token invalido'
      });
    }

    console.error('Error en autenticacion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para verificar roles especificos
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes'
      });
    }

    next();
  };
};
