"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recordingController_1 = require("../controllers/recordingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Rutas para conductores
router.post('/start', auth_1.authenticateToken, (0, auth_1.requireRole)(['driver']), recordingController_1.RecordingController.startRecording);
router.post('/stop', auth_1.authenticateToken, (0, auth_1.requireRole)(['driver']), recordingController_1.RecordingController.stopRecording);
// Rutas para administradores
router.get('/trip/:tripId', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), recordingController_1.RecordingController.getTripRecordings);
exports.default = router;
