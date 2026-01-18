"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
// Rutas públicas
router.post('/register', validation_1.validateRegister, authController_1.AuthController.register);
router.post('/login', validation_1.validateLogin, authController_1.AuthController.login);
// Rutas protegidas
router.get('/verify', auth_1.authenticateToken, authController_1.AuthController.verifyToken);
router.post('/logout', auth_1.authenticateToken, authController_1.AuthController.logout);
exports.default = router;
