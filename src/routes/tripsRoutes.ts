import { Router } from 'express';
import { TripsController } from '../controllers/tripsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * RUTAS DE VIAJES (TRIPS)
 * Todas las rutas requieren autenticación
 */

// POST /api/trips/request - Solicitar nuevo viaje (Pasajero)
router.post('/request', authenticateToken, TripsController.requestTrip);

// PATCH /api/trips/:tripId/accept - Aceptar viaje (Conductor)
router.patch('/:tripId/accept', authenticateToken, TripsController.acceptTrip);

// PATCH /api/trips/:tripId/arrive - Notificar llegada al punto de recogida (Conductor)
router.patch('/:tripId/arrive', authenticateToken, TripsController.driverArrived);

// PATCH /api/trips/:tripId/start - Iniciar viaje (Conductor)
router.patch('/:tripId/start', authenticateToken, TripsController.startTrip);

// PATCH /api/trips/:tripId/complete - Completar viaje (Conductor)
router.patch('/:tripId/complete', authenticateToken, TripsController.completeTrip);

// PATCH /api/trips/:tripId/cancel - Cancelar viaje (Pasajero/Conductor/Admin)
router.patch('/:tripId/cancel', authenticateToken, TripsController.cancelTrip);

// GET /api/trips/:tripId - Obtener detalles de un viaje
router.get('/:tripId', authenticateToken, TripsController.getTripDetails);

// GET /api/trips/my-trips - Obtener historial de viajes del usuario
router.get('/my-trips', authenticateToken, TripsController.getMyTrips);

export default router;
