 
import { Router } from 'express';
import { PanicController } from '../controllers/panicController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para usuarios (pasajeros/conductores)
router.post('/volume-button', authenticateToken, PanicController.volumeButtonPanic);
router.post('/app-button', authenticateToken, PanicController.appButtonPanic);

// Rutas para administradores
router.get('/alerts', authenticateToken, requireRole(['admin']), PanicController.getActivePanicAlerts);
router.patch('/alerts/:alertId/resolve', authenticateToken, requireRole(['admin']), PanicController.resolveAlert);

export default router;