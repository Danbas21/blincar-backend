"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reservationController_1 = require("../controllers/reservationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para pasajeros
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['passenger']), reservationController_1.ReservationController.createReservation);
router.get('/my-reservations', auth_1.authenticateToken, (0, auth_1.requireRole)(['passenger']), reservationController_1.ReservationController.getUserReservations);
// Rutas para administradores y conductores
router.patch('/:reservationId/assign', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin', 'driver']), reservationController_1.ReservationController.assignDriverToReservation);
exports.default = router;
