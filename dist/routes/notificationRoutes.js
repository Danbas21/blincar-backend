"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para todos los usuarios
router.get('/', auth_1.authenticateToken, notificationController_1.NotificationController.getUserNotifications);
router.patch('/:notificationId/read', auth_1.authenticateToken, notificationController_1.NotificationController.markAsRead);
router.patch('/mark-all-read', auth_1.authenticateToken, notificationController_1.NotificationController.markAllAsRead);
// Rutas para administradores
router.post('/create', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), notificationController_1.NotificationController.createNotification);
exports.default = router;
