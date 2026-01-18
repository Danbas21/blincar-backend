 
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../types';
import { io } from '../index';

export class PanicController {
  
  // Botón de pánico por volumen (6 segundos)
  static async volumeButtonPanic(req: Request, res: Response) {
    const { tripId, coordinates } = req.body;
    const userId = req.user.id;

    try {
      // Obtener información del viaje
      const tripResult = await pool.query(`
        SELECT t.*, 
               p.first_name as passenger_name, p.last_name as passenger_lastname,
               d.first_name as driver_name, d.last_name as driver_lastname
        FROM trips t
        LEFT JOIN users p ON t.passenger_id = p.id
        LEFT JOIN users d ON t.driver_id = d.id
        WHERE t.id = $1
      `, [tripId]);

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const trip = tripResult.rows[0];

      // Insertar alerta de pánico
      const panicResult = await pool.query(`
        INSERT INTO panic_alerts 
        (trip_id, user_id, alert_type, location_coordinates)
        VALUES ($1, $2, 'volume_button', $3)
        RETURNING id
      `, [tripId, userId, JSON.stringify(coordinates)]);

      const panicId = panicResult.rows[0].id;

      // Actualizar contador en trip
      await pool.query(`
        UPDATE trips SET panic_alerts_count = panic_alerts_count + 1 
        WHERE id = $1
      `, [tripId]);

      // Enviar notificación en tiempo real al panel de administrador
      io.emit('panic_alert', {
        panicId,
        tripId,
        alertType: 'volume_button',
        clientName: `${trip.passenger_name} ${trip.passenger_lastname}`,
        driverName: trip.driver_name ? `${trip.driver_name} ${trip.driver_lastname}` : 'Sin conductor asignado',
        location: coordinates,
        timestamp: new Date().toISOString()
      });

      // Crear notificación para administradores
      await pool.query(`
        INSERT INTO notifications (user_id, title, message, notification_type, related_trip_id, data)
        SELECT id, 'ALERTA DE PÁNICO', 
               'Botón de pánico activado por volumen en viaje en curso',
               'panic_alert', $1, $2
        FROM users WHERE role = 'admin'
      `, [tripId, JSON.stringify({ panicId, alertType: 'volume_button' })]);

      const response: ApiResponse = {
        success: true,
        message: 'Alerta de pánico enviada al panel de administración',
        data: { panicId },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error en botón de pánico por volumen:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Botón de pánico dentro de la app
  static async appButtonPanic(req: Request, res: Response) {
    const { tripId, coordinates } = req.body;
    const userId = req.user.id;

    try {
      // Obtener contacto de emergencia del usuario
      const userResult = await pool.query(`
        SELECT emergency_contact_name, emergency_contact_phone, first_name, last_name
        FROM users WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const user = userResult.rows[0];

      if (!user.emergency_contact_phone) {
        return res.status(400).json({
          success: false,
          message: 'No hay contacto de emergencia registrado',
          timestamp: new Date().toISOString()
        });
      }

      // Insertar alerta de pánico
      const panicResult = await pool.query(`
        INSERT INTO panic_alerts 
        (trip_id, user_id, alert_type, location_coordinates, emergency_contact_notified)
        VALUES ($1, $2, 'app_button', $3, true)
        RETURNING id
      `, [tripId, userId, JSON.stringify(coordinates)]);

      // TODO: Integrar con servicio SMS (Twilio/similar)
      // Por ahora simulamos el envío
      const smsMessage = `${user.first_name} ${user.last_name} requiere de tu apoyo y seguimiento`;
      console.log(`SMS enviado a ${user.emergency_contact_phone}: ${smsMessage}`);

      // Actualizar contador en trip
      await pool.query(`
        UPDATE trips SET panic_alerts_count = panic_alerts_count + 1 
        WHERE id = $1
      `, [tripId]);

      const response: ApiResponse = {
        success: true,
        message: 'Mensaje de emergencia enviado a contacto registrado',
        data: { 
          panicId: panicResult.rows[0].id,
          messageSent: smsMessage,
          contactPhone: user.emergency_contact_phone.substring(0, 6) + '****' // Ocultar últimos dígitos
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error en botón de pánico de app:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Obtener alertas de pánico activas (para admin)
  static async getActivePanicAlerts(req: Request, res: Response) {
    try {
      const alertsResult = await pool.query(`
        SELECT pa.*, 
               t.origin_address, t.destination_address,
               u.first_name as user_name, u.last_name as user_lastname,
               u.phone as user_phone
        FROM panic_alerts pa
        JOIN trips t ON pa.trip_id = t.id
        JOIN users u ON pa.user_id = u.id
        WHERE pa.is_resolved = false
        ORDER BY pa.created_at DESC
      `);

      const response: ApiResponse = {
        success: true,
        message: 'Alertas de pánico activas obtenidas',
        data: alertsResult.rows,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error obteniendo alertas de pánico:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Marcar alerta como resuelta
  static async resolveAlert(req: Request, res: Response) {
    const { alertId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    try {
      await pool.query(`
        UPDATE panic_alerts 
        SET is_resolved = true, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP, admin_notes = $2
        WHERE id = $3
      `, [adminId, notes, alertId]);

      res.status(200).json({
        success: true,
        message: 'Alerta marcada como resuelta',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error resolviendo alerta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }
}