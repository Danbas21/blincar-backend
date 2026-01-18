"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routeController_1 = require("../controllers/routeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para conductores
router.post('/request-change', auth_1.authenticateToken, (0, auth_1.requireRole)(['driver']), routeController_1.RouteController.requestRouteChange);
// Rutas para pasajeros
router.patch('/changes/:routeChangeId/respond', auth_1.authenticateToken, (0, auth_1.requireRole)(['passenger']), routeController_1.RouteController.respondToRouteChange);
// Rutas para administradores
router.get('/changes/pending', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), routeController_1.RouteController.getPendingRouteChanges);
exports.default = router;
