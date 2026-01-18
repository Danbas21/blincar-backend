import { Request, Response } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../types';

export class PaymentController {
  
  // Preautorización con Stripe (retención)
  static async preauthorizePayment(req: Request, res: Response) {
    const { tripId, amount, paymentMethodId } = req.body;
    const userId = req.user.id;

    try {
      // TODO: Integrar con Stripe Payment Intent
      // Por ahora simulamos la preautorización
      const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insertar registro de pago
      await pool.query(`
        INSERT INTO payments 
        (trip_id, passenger_id, amount, payment_method, stripe_payment_intent_id, status)
        VALUES ($1, $2, $3, 'card', $4, 'pending')
      `, [tripId, userId, amount, paymentIntentId]);

      const response: ApiResponse = {
        success: true,
        message: 'Pago preautorizado exitosamente',
        data: {
          paymentIntentId,
          amount,
          status: 'preauthorized'
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error en preautorización:', error);
      res.status(500).json({
        success: false,
        message: 'Error procesando pago',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Confirmar pago efectivo exitoso
  static async confirmCashPayment(req: Request, res: Response) {
    const { tripId, amount } = req.body;
    const driverId = req.user.id;

    try {
      // Obtener información del viaje
      const tripResult = await pool.query(`
        SELECT passenger_id, service_type_id FROM trips WHERE id = $1
      `, [tripId]);

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const { passenger_id, service_type_id } = tripResult.rows[0];

      // Obtener porcentaje de comisión
      const serviceResult = await pool.query(`
        SELECT commission_percentage FROM service_types WHERE id = $1
      `, [service_type_id]);

      const commissionPercentage = serviceResult.rows[0]?.commission_percentage || 15.00;
      const commissionAmount = (amount * commissionPercentage) / 100;
      const netAmount = amount - commissionAmount;

      // Registrar pago en efectivo
      await pool.query(`
        INSERT INTO payments 
        (trip_id, passenger_id, driver_id, amount, payment_method, status, platform_fee, driver_earnings)
        VALUES ($1, $2, $3, $4, 'cash', 'completed', $5, $6)
      `, [tripId, passenger_id, driverId, amount, commissionAmount, netAmount]);

      // Obtener driver_id de la tabla drivers
      const driverResult = await pool.query(`
        SELECT id FROM drivers WHERE user_id = $1
      `, [driverId]);

      const driverDbId = driverResult.rows[0]?.id;

      if (driverDbId) {
        // Registrar ganancia del conductor
        await pool.query(`
          INSERT INTO driver_earnings 
          (driver_id, trip_id, earning_type, amount, commission_percentage, commission_amount, net_amount, payment_method, payment_status)
          VALUES ($1, $2, 'cash_collection', $3, $4, $5, $6, 'cash', 'completed')
        `, [driverDbId, tripId, amount, commissionPercentage, commissionAmount, netAmount]);

        // Actualizar saldo del conductor (restar comisión)
        await pool.query(`
          UPDATE drivers 
          SET total_earnings = total_earnings - $1
          WHERE id = $2
        `, [commissionAmount, driverDbId]);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Pago en efectivo confirmado',
        data: {
          amount,
          commission: commissionAmount,
          earnings: netAmount
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error confirmando pago efectivo:', error);
      res.status(500).json({
        success: false,
        message: 'Error procesando pago',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Reportar pago fallido
  static async reportFailedCashPayment(req: Request, res: Response) {
    const { tripId, reason } = req.body;
    const driverId = req.user.id;

    try {
      // Obtener información del viaje
      const tripResult = await pool.query(`
        SELECT passenger_id FROM trips WHERE id = $1
      `, [tripId]);

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const { passenger_id } = tripResult.rows[0];

      // Registrar pago fallido
      await pool.query(`
        INSERT INTO payments 
        (trip_id, passenger_id, driver_id, amount, payment_method, status)
        VALUES ($1, $2, $3, 0, 'cash', 'failed')
      `, [tripId, passenger_id, driverId]);

      // Crear notificación para administradores
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, notification_type, related_trip_id, data)
        SELECT id, 'PAGO PENDIENTE', 
               'Viaje con pago en efectivo no realizado',
               'payment_received', $1, $2
        FROM users WHERE role = 'admin'
      `, [tripId, JSON.stringify({ reason, status: 'payment_failed' })]);

      const response: ApiResponse = {
        success: true,
        message: 'Reporte de pago fallido enviado al administrador',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error reportando pago fallido:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Obtener billetera del conductor
  static async getDriverWallet(req: Request, res: Response) {
    const driverId = req.user.id;

    try {
      // Obtener driver_id de la tabla drivers
      const driverResult = await pool.query(`
        SELECT id, total_earnings FROM drivers WHERE user_id = $1
      `, [driverId]);

      if (driverResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Conductor no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const { id: driverDbId, total_earnings } = driverResult.rows[0];

      // Obtener ganancias del mes actual
      const earningsResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN earning_type = 'cash_collection' THEN net_amount ELSE 0 END), 0) as monthly_cash,
          COALESCE(SUM(CASE WHEN earning_type = 'trip_payment' THEN net_amount ELSE 0 END), 0) as monthly_cards,
          COUNT(*) as total_transactions
        FROM driver_earnings 
        WHERE driver_id = $1 
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `, [driverDbId]);

      const earnings = earningsResult.rows[0];

      // Obtener últimas transacciones
      const transactionsResult = await pool.query(`
        SELECT earning_type, amount, net_amount, payment_method, created_at
        FROM driver_earnings 
        WHERE driver_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [driverDbId]);

      const response: ApiResponse = {
        success: true,
        message: 'Información de billetera obtenida',
        data: {
          currentBalance: total_earnings,
          monthlyEarnings: {
            cash: earnings.monthly_cash,
            cards: earnings.monthly_cards,
            total: parseFloat(earnings.monthly_cash) + parseFloat(earnings.monthly_cards)
          },
          recentTransactions: transactionsResult.rows
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error obteniendo billetera:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }
}