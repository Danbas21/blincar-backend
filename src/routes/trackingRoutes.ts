 
import { Router } from 'express';
import { TrackingController } from '../controllers/trackingController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para usuarios (conductores y pasajeros)
router.post('/location', authenticateToken, TrackingController.updateLocation);

// Rutas para administradores
router.get('/trip/:tripId/history', authenticateToken, requireRole(['admin']), TrackingController.getTripLocationHistory);
router.get('/drivers/nearby', authenticateToken, requireRole(['admin']), TrackingController.getNearbyDrivers);

export default router;