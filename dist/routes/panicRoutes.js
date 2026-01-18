"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const panicController_1 = require("../controllers/panicController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para usuarios (pasajeros/conductores)
router.post('/volume-button', auth_1.authenticateToken, panicController_1.PanicController.volumeButtonPanic);
router.post('/app-button', auth_1.authenticateToken, panicController_1.PanicController.appButtonPanic);
// Rutas para administradores
router.get('/alerts', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), panicController_1.PanicController.getActivePanicAlerts);
router.patch('/alerts/:alertId/resolve', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), panicController_1.PanicController.resolveAlert);
exports.default = router;
