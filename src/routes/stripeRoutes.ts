import { Router, raw } from 'express';
import { StripeController } from '../controllers/stripeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Configuracion publica (para obtener publishable key)
router.get('/config', StripeController.getConfig);

// Rutas protegidas para pasajeros
router.post('/customer', authenticateToken, requireRole(['passenger']), StripeController.createOrGetCustomer);
router.post('/setup-intent', authenticateToken, requireRole(['passenger']), StripeController.createSetupIntent);
router.post('/payment-method', authenticateToken, requireRole(['passenger']), StripeController.attachPaymentMethod);
router.get('/payment-methods', authenticateToken, requireRole(['passenger']), StripeController.listPaymentMethods);
router.put('/payment-method/:paymentMethodId/default', authenticateToken, requireRole(['passenger']), StripeController.setDefaultPaymentMethod);
router.delete('/payment-method/:paymentMethodId', authenticateToken, requireRole(['passenger']), StripeController.deletePaymentMethod);
router.post('/payment-intent', authenticateToken, requireRole(['passenger']), StripeController.createPaymentIntent);

// Webhook de Stripe (NO autenticado - usa firma de Stripe)
// IMPORTANTE: Este endpoint debe recibir el body RAW, no parseado como JSON
router.post('/webhook', raw({ type: 'application/json' }), StripeController.handleWebhook);

export default router;
