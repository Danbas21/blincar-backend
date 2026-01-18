import { Request, Response } from 'express';
import Stripe from 'stripe';
import { pool } from '../config/database';
import { ApiResponse } from '../types';

// Inicializar Stripe con la clave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export class StripeController {

  /**
   * Crear o obtener un Customer de Stripe para el usuario
   * POST /api/stripe/customer
   */
  static async createOrGetCustomer(req: Request, res: Response) {
    const userId = req.user.id;

    try {
      // Verificar si el usuario ya tiene un stripe_customer_id
      const userResult = await pool.query(
        'SELECT stripe_customer_id, email, full_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const user = userResult.rows[0];

      // Si ya tiene customer_id, devolverlo
      if (user.stripe_customer_id) {
        const response: ApiResponse = {
          success: true,
          message: 'Customer existente',
          data: { customerId: user.stripe_customer_id },
          timestamp: new Date().toISOString()
        };
        return res.status(200).json(response);
      }

      // Crear nuevo Customer en Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          userId: userId,
          platform: 'blincar'
        }
      });

      // Guardar stripe_customer_id en la base de datos
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, userId]
      );

      const response: ApiResponse = {
        success: true,
        message: 'Customer creado exitosamente',
        data: { customerId: customer.id },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error creando Stripe Customer:', error);
      res.status(500).json({
        success: false,
        message: 'Error creando customer de pago',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Crear un SetupIntent para agregar una tarjeta de forma segura
   * POST /api/stripe/setup-intent
   */
  static async createSetupIntent(req: Request, res: Response) {
    const userId = req.user.id;

    try {
      // Obtener el stripe_customer_id del usuario
      const userResult = await pool.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Usuario no tiene customer de Stripe. Crea uno primero.',
          timestamp: new Date().toISOString()
        });
      }

      const customerId = userResult.rows[0].stripe_customer_id;

      // Crear SetupIntent para guardar tarjeta
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          userId: userId
        }
      });

      const response: ApiResponse = {
        success: true,
        message: 'SetupIntent creado',
        data: {
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error creando SetupIntent:', error);
      res.status(500).json({
        success: false,
        message: 'Error preparando registro de tarjeta',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Agregar un PaymentMethod (tarjeta) al Customer
   * POST /api/stripe/payment-method
   */
  static async attachPaymentMethod(req: Request, res: Response) {
    const { paymentMethodId } = req.body;
    const userId = req.user.id;

    try {
      // Obtener el stripe_customer_id del usuario
      const userResult = await pool.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Usuario no tiene customer de Stripe',
          timestamp: new Date().toISOString()
        });
      }

      const customerId = userResult.rows[0].stripe_customer_id;

      // Vincular el PaymentMethod al Customer
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Verificar si es la primera tarjeta para establecerla como default
      const existingMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      if (existingMethods.data.length === 1) {
        // Es la primera tarjeta, establecerla como default
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Tarjeta agregada exitosamente',
        data: {
          id: paymentMethod.id,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
          expMonth: paymentMethod.card?.exp_month,
          expYear: paymentMethod.card?.exp_year,
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      console.error('Error agregando PaymentMethod:', error);

      let message = 'Error agregando tarjeta';
      if (error.type === 'StripeCardError') {
        message = error.message;
      }

      res.status(400).json({
        success: false,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Listar tarjetas guardadas del usuario
   * GET /api/stripe/payment-methods
   */
  static async listPaymentMethods(req: Request, res: Response) {
    const userId = req.user.id;

    try {
      // Obtener el stripe_customer_id del usuario
      const userResult = await pool.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
        // Usuario sin customer, devolver lista vacia
        return res.status(200).json({
          success: true,
          message: 'Sin metodos de pago',
          data: { paymentMethods: [] },
          timestamp: new Date().toISOString()
        });
      }

      const customerId = userResult.rows[0].stripe_customer_id;

      // Obtener el customer para ver cual es el default
      const customer = await stripe.customers.retrieve(customerId);
      const defaultPaymentMethodId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

      // Listar PaymentMethods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      const formattedMethods = paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === defaultPaymentMethodId,
      }));

      const response: ApiResponse = {
        success: true,
        message: 'Metodos de pago obtenidos',
        data: { paymentMethods: formattedMethods },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error listando PaymentMethods:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo tarjetas',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Establecer tarjeta como default
   * PUT /api/stripe/payment-method/:paymentMethodId/default
   */
  static async setDefaultPaymentMethod(req: Request, res: Response) {
    const { paymentMethodId } = req.params;
    const userId = req.user.id;

    try {
      const userResult = await pool.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Usuario no tiene customer de Stripe',
          timestamp: new Date().toISOString()
        });
      }

      const customerId = userResult.rows[0].stripe_customer_id;

      // Actualizar el default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Tarjeta establecida como principal',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error estableciendo default:', error);
      res.status(500).json({
        success: false,
        message: 'Error actualizando tarjeta',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Eliminar una tarjeta
   * DELETE /api/stripe/payment-method/:paymentMethodId
   */
  static async deletePaymentMethod(req: Request, res: Response) {
    const { paymentMethodId } = req.params;

    try {
      // Desvincular el PaymentMethod
      await stripe.paymentMethods.detach(paymentMethodId);

      const response: ApiResponse = {
        success: true,
        message: 'Tarjeta eliminada exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error eliminando PaymentMethod:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando tarjeta',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Crear PaymentIntent para cobrar un viaje
   * POST /api/stripe/payment-intent
   */
  static async createPaymentIntent(req: Request, res: Response) {
    const { amount, paymentMethodId, tripId } = req.body;
    const userId = req.user.id;

    try {
      // Validar monto minimo (Stripe requiere minimo 10 MXN)
      if (amount < 10) {
        return res.status(400).json({
          success: false,
          message: 'El monto minimo es $10 MXN',
          timestamp: new Date().toISOString()
        });
      }

      // Obtener el stripe_customer_id del usuario
      const userResult = await pool.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
        return res.status(400).json({
          success: false,
          message: 'Usuario no tiene customer de Stripe',
          timestamp: new Date().toISOString()
        });
      }

      const customerId = userResult.rows[0].stripe_customer_id;

      // Crear el PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe usa centavos
        currency: 'mxn',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true, // Confirmar inmediatamente
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          userId: userId,
          tripId: tripId || 'pending',
          platform: 'blincar'
        },
        description: `Viaje Blincar - ${tripId || 'Nuevo viaje'}`,
      });

      // Si el pago fue exitoso, registrar en la base de datos
      if (paymentIntent.status === 'succeeded') {
        await pool.query(`
          INSERT INTO payments
          (trip_id, passenger_id, amount, currency, payment_method, stripe_payment_intent_id, status)
          VALUES ($1, $2, $3, 'MXN', 'card', $4, 'completed')
        `, [tripId, userId, amount, paymentIntent.id]);
      }

      const response: ApiResponse = {
        success: paymentIntent.status === 'succeeded',
        message: paymentIntent.status === 'succeeded'
          ? 'Pago procesado exitosamente'
          : 'Pago requiere accion adicional',
        data: {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: amount,
          clientSecret: paymentIntent.client_secret, // Para 3D Secure si es necesario
        },
        timestamp: new Date().toISOString()
      };

      res.status(paymentIntent.status === 'succeeded' ? 200 : 202).json(response);

    } catch (error: any) {
      console.error('Error creando PaymentIntent:', error);

      let message = 'Error procesando pago';
      let statusCode = 500;

      if (error.type === 'StripeCardError') {
        message = error.message;
        statusCode = 400;
      } else if (error.type === 'StripeInvalidRequestError') {
        message = 'Datos de pago invalidos';
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: error.code,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Webhook de Stripe para eventos de pago
   * POST /api/stripe/webhook
   */
  static async handleWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      // Verificar firma del webhook
      event = stripe.webhooks.constructEvent(
        req.body, // raw body
        sig,
        webhookSecret
      );
    } catch (error: any) {
      console.error('Error verificando webhook:', error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Manejar eventos
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Pago exitoso:', paymentIntent.id);

        // Actualizar estado del pago en la base de datos
        await pool.query(`
          UPDATE payments SET status = 'completed', processed_at = NOW()
          WHERE stripe_payment_intent_id = $1
        `, [paymentIntent.id]);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log('Pago fallido:', failedPayment.id);

        await pool.query(`
          UPDATE payments SET status = 'failed'
          WHERE stripe_payment_intent_id = $1
        `, [failedPayment.id]);
        break;

      case 'charge.refunded':
        const refund = event.data.object as Stripe.Charge;
        console.log('Reembolso procesado:', refund.id);

        await pool.query(`
          UPDATE payments SET status = 'refunded'
          WHERE stripe_payment_intent_id = $1
        `, [refund.payment_intent]);
        break;

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
  }

  /**
   * Obtener la publishable key para el cliente
   * GET /api/stripe/config
   */
  static async getConfig(req: Request, res: Response) {
    const response: ApiResponse = {
      success: true,
      message: 'Configuracion de Stripe',
      data: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  }
}
