 
import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Rutas para pasajeros
router.post('/preauthorize', authenticateToken, requireRole(['passenger']), PaymentController.preauthorizePayment);

// Rutas para conductores
router.post('/cash/confirm', authenticateToken, requireRole(['driver']), PaymentController.confirmCashPayment);
router.post('/cash/failed', authenticateToken, requireRole(['driver']), PaymentController.reportFailedCashPayment);
router.get('/wallet', authenticateToken, requireRole(['driver']), PaymentController.getDriverWallet);

export default router;