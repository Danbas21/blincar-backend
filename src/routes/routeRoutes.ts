 
import { Router } from 'express';
import { RouteController } from '../controllers/routeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Proxy para Google Directions API (público - usado por la app móvil)
router.get('/directions', RouteController.getDirections);

// Proxy para Google Places Autocomplete (público - usado por la app móvil)
router.get('/places/autocomplete', RouteController.getPlacesAutocomplete);

// Proxy para Google Place Details (público - obtiene coordenadas por placeId)
router.get('/places/details', RouteController.getPlaceDetails);

// Proxy para Google Geocoding reverso (coordenadas → dirección)
router.get('/places/geocode', RouteController.reverseGeocode);

// Rutas para conductores
router.post('/request-change', authenticateToken, requireRole(['driver']), RouteController.requestRouteChange);

// Rutas para pasajeros
router.patch('/changes/:routeChangeId/respond', authenticateToken, requireRole(['passenger']), RouteController.respondToRouteChange);

// Rutas para administradores
router.get('/changes/pending', authenticateToken, requireRole(['admin']), RouteController.getPendingRouteChanges);

export default router;