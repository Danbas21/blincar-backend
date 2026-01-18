 
import { Router } from 'express';
import { RecordingController } from '../controllers/recordingController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para conductores
router.post('/start', authenticateToken, requireRole(['driver']), RecordingController.startRecording);
router.post('/stop', authenticateToken, requireRole(['driver']), RecordingController.stopRecording);

// Rutas para administradores
router.get('/trip/:tripId', authenticateToken, requireRole(['admin']), RecordingController.getTripRecordings);

export default router;