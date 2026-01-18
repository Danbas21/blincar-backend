"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trackingController_1 = require("../controllers/trackingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para usuarios (conductores y pasajeros)
router.post('/location', auth_1.authenticateToken, trackingController_1.TrackingController.updateLocation);
// Rutas para administradores
router.get('/trip/:tripId/history', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), trackingController_1.TrackingController.getTripLocationHistory);
router.get('/drivers/nearby', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), trackingController_1.TrackingController.getNearbyDrivers);
exports.default = router;
