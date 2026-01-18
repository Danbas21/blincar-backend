 
import { Router } from 'express';
import { RouteController } from '../controllers/routeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para conductores
router.post('/request-change', authenticateToken, requireRole(['driver']), RouteController.requestRouteChange);

// Rutas para pasajeros
router.patch('/changes/:routeChangeId/respond', authenticateToken, requireRole(['passenger']), RouteController.respondToRouteChange);

// Rutas para administradores
router.get('/changes/pending', authenticateToken, requireRole(['admin']), RouteController.getPendingRouteChanges);

export default router;