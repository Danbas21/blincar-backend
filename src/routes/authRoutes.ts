
import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { validateRegister, validateLogin } from '../middleware/validation';

const router = Router();

// Rutas públicas
router.post('/register', validateRegister, AuthController.register);
router.post('/login', validateLogin, AuthController.login);

// Rutas protegidas
router.get('/verify', authenticateToken, AuthController.verifyToken);
router.post('/logout', authenticateToken, AuthController.logout);

export default router;