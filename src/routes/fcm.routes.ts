import { Router } from 'express';
import { FCMController } from '../controllers/fcm.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * RUTAS FCM (Firebase Cloud Messaging)
 *
 * Todas las rutas requieren autenticación (JWT token)
 */

// POST /api/fcm/register - Registrar token FCM del dispositivo
router.post('/register', authenticateToken, FCMController.registerToken);

// POST /api/fcm/remove - Eliminar token FCM (logout)
router.post('/remove', authenticateToken, FCMController.removeToken);

// GET /api/fcm/stats - Obtener estadísticas de notificaciones (opcional, para debugging)
router.get('/stats', authenticateToken, FCMController.getStats);

export default router;
