"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para pasajeros
router.post('/preauthorize', auth_1.authenticateToken, (0, auth_1.requireRole)(['passenger']), paymentController_1.PaymentController.preauthorizePayment);
// Rutas para conductores
router.post('/cash/confirm', auth_1.authenticateToken, (0, auth_1.requireRole)(['driver']), paymentController_1.PaymentController.confirmCashPayment);
router.post('/cash/failed', auth_1.authenticateToken, (0, auth_1.requireRole)(['driver']), paymentController_1.PaymentController.reportFailedCashPayment);
router.get('/wallet', auth_1.authenticateToken, (0, auth_1.requireRole)(['driver']), paymentController_1.PaymentController.getDriverWallet);
exports.default = router;
