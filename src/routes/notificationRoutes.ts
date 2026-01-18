 
import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para todos los usuarios
router.get('/', authenticateToken, NotificationController.getUserNotifications);
router.patch('/:notificationId/read', authenticateToken, NotificationController.markAsRead);
router.patch('/mark-all-read', authenticateToken, NotificationController.markAllAsRead);

// Rutas para administradores
router.post('/create', authenticateToken, requireRole(['admin']), NotificationController.createNotification);

export default router;