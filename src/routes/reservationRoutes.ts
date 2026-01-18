 
import { Router } from 'express';
import { ReservationController } from '../controllers/reservationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para pasajeros
router.post('/', authenticateToken, requireRole(['passenger']), ReservationController.createReservation);
router.get('/my-reservations', authenticateToken, requireRole(['passenger']), ReservationController.getUserReservations);

// Rutas para administradores y conductores
router.patch('/:reservationId/assign', authenticateToken, requireRole(['admin', 'driver']), ReservationController.assignDriverToReservation);

export default router;