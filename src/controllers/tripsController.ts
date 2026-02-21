import { Request, Response } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../types';
import { NotificationHelper } from '../helpers/notification.helper';
import { io } from '../index';

/**
 * FASE 2: Controller de Viajes (Trips)
 *
 * Maneja el ciclo de vida completo de los viajes:
 * 1. Request trip (requested)
 * 2. Accept trip (accepted)
 * 3. Start trip (in_progress)
 * 4. Complete trip (completed)
 * 5. Cancel trip (cancelled)
 *
 * Cada cambio de estado dispara notificaciones push automáticas.
 */
export class TripsController {
  /**
   * POST /api/trips/request
   * Solicitar un nuevo viaje (Pasajero)
   */
  static async requestTrip(req: Request, res: Response) {
    const passengerId = req.user.id;
    const {
      originAddress,
      destinationAddress,
      originCoordinates,
      destinationCoordinates,
      estimatedPrice,
      serviceTypeId,
    } = req.body;

    try {
      // Crear viaje con estado 'requested'
      const tripResult = await pool.query(
        `INSERT INTO trips
         (passenger_id, origin_address, destination_address, origin_coordinates,
          destination_coordinates, estimated_price, status, requested_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'requested', CURRENT_TIMESTAMP)
         RETURNING id, estimated_price`,
        [
          passengerId,
          originAddress,
          destinationAddress,
          JSON.stringify(originCoordinates),
          JSON.stringify(destinationCoordinates),
          estimatedPrice,
        ]
      );

      const tripId = tripResult.rows[0].id;

      // 🔔 NOTIFICACIÓN PUSH: Notificar a conductores disponibles
      const driverIds = await NotificationHelper.getAvailableDriverIds(originCoordinates);

      if (driverIds.length > 0) {
        await NotificationHelper.notifyTripRequested({
          driverIds,
          passengerId,
          tripId,
          origin: originAddress,
          destination: destinationAddress,
          estimatedPrice,
          io,
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Viaje solicitado exitosamente',
        data: {
          tripId,
          status: 'requested',
          estimatedPrice: tripResult.rows[0].estimated_price,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error solicitando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * PATCH /api/trips/:tripId/accept
   * Conductor acepta el viaje
   */
  static async acceptTrip(req: Request, res: Response) {
    const { tripId } = req.params;
    const driverId = req.user.id;
    const { estimatedArrival } = req.body; // minutos

    try {
      // Verificar que el viaje existe y está en estado 'requested'
      const tripResult = await pool.query(
        'SELECT passenger_id, status FROM trips WHERE id = $1',
        [tripId]
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString(),
        });
      }

      const trip = tripResult.rows[0];

      if (trip.status !== 'requested') {
        return res.status(400).json({
          success: false,
          message: `Viaje no disponible (estado actual: ${trip.status})`,
          timestamp: new Date().toISOString(),
        });
      }

      // Actualizar viaje: asignar conductor y cambiar estado
      await pool.query(
        `UPDATE trips
         SET driver_id = $1, status = 'accepted', accepted_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [driverId, tripId]
      );

      // 🔔 NOTIFICACIÓN PUSH: Notificar al pasajero
      const driverResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [driverId]
      );
      const driver = driverResult.rows[0];
      const driverName = `${driver.first_name} ${driver.last_name}`;

      await NotificationHelper.notifyTripAccepted({
        passengerId: trip.passenger_id,
        driverId,
        driverName,
        tripId,
        estimatedArrival,
        io,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Viaje aceptado exitosamente',
        data: { tripId, status: 'accepted' },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error aceptando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * PATCH /api/trips/:tripId/arrive
   * Conductor llegó al punto de recogida
   */
  static async driverArrived(req: Request, res: Response) {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
      const tripResult = await pool.query(
        'SELECT passenger_id, driver_id, status FROM trips WHERE id = $1',
        [tripId]
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString(),
        });
      }

      const trip = tripResult.rows[0];

      if (trip.driver_id !== driverId) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado',
          timestamp: new Date().toISOString(),
        });
      }

      // 🔔 NOTIFICACIÓN PUSH: Notificar al pasajero que el conductor llegó
      const driverResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [driverId]
      );
      const driver = driverResult.rows[0];
      const driverName = `${driver.first_name} ${driver.last_name}`;

      await NotificationHelper.notifyDriverArrived({
        passengerId: trip.passenger_id,
        driverName,
        tripId,
        io,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Pasajero notificado de tu llegada',
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error notificando llegada:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * PATCH /api/trips/:tripId/start
   * Iniciar el viaje
   */
  static async startTrip(req: Request, res: Response) {
    const { tripId } = req.params;
    const driverId = req.user.id;

    try {
      const tripResult = await pool.query(
        'SELECT passenger_id, driver_id, status FROM trips WHERE id = $1',
        [tripId]
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString(),
        });
      }

      const trip = tripResult.rows[0];

      if (trip.driver_id !== driverId) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado',
          timestamp: new Date().toISOString(),
        });
      }

      if (trip.status !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: `No se puede iniciar viaje en estado ${trip.status}`,
          timestamp: new Date().toISOString(),
        });
      }

      // Actualizar estado a 'in_progress'
      await pool.query(
        `UPDATE trips
         SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [tripId]
      );

      // 🔔 NOTIFICACIÓN PUSH: Notificar al pasajero
      await NotificationHelper.notifyTripStarted({
        passengerId: trip.passenger_id,
        tripId,
        io,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Viaje iniciado',
        data: { tripId, status: 'in_progress' },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error iniciando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * PATCH /api/trips/:tripId/complete
   * Completar el viaje
   */
  static async completeTrip(req: Request, res: Response) {
    const { tripId } = req.params;
    const driverId = req.user.id;
    const { actualPrice } = req.body;

    try {
      const tripResult = await pool.query(
        'SELECT passenger_id, driver_id, status, estimated_price FROM trips WHERE id = $1',
        [tripId]
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString(),
        });
      }

      const trip = tripResult.rows[0];

      if (trip.driver_id !== driverId) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado',
          timestamp: new Date().toISOString(),
        });
      }

      if (trip.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: `No se puede completar viaje en estado ${trip.status}`,
          timestamp: new Date().toISOString(),
        });
      }

      const fare = actualPrice || trip.estimated_price;

      // Actualizar estado a 'completed'
      await pool.query(
        `UPDATE trips
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, actual_price = $1
         WHERE id = $2`,
        [fare, tripId]
      );

      // 🔔 NOTIFICACIÓN PUSH: Notificar al pasajero y conductor
      await NotificationHelper.notifyTripCompleted({
        passengerId: trip.passenger_id,
        driverId,
        tripId,
        fare: parseFloat(fare),
        io,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Viaje completado exitosamente',
        data: {
          tripId,
          status: 'completed',
          fare,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error completando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * PATCH /api/trips/:tripId/cancel
   * Cancelar el viaje
   */
  static async cancelTrip(req: Request, res: Response) {
    const { tripId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role; // 'passenger' | 'driver'
    const { reason } = req.body;

    try {
      const tripResult = await pool.query(
        'SELECT passenger_id, driver_id, status FROM trips WHERE id = $1',
        [tripId]
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString(),
        });
      }

      const trip = tripResult.rows[0];

      // Verificar autorización
      if (
        trip.passenger_id !== userId &&
        trip.driver_id !== userId &&
        userRole !== 'admin'
      ) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para cancelar este viaje',
          timestamp: new Date().toISOString(),
        });
      }

      // No se puede cancelar un viaje ya completado
      if (trip.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'No se puede cancelar un viaje completado',
          timestamp: new Date().toISOString(),
        });
      }

      const cancelledBy = trip.passenger_id === userId ? 'passenger' : 'driver';

      // Actualizar estado a 'cancelled'
      await pool.query(
        `UPDATE trips
         SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
             cancelled_by = $1, cancel_reason = $2
         WHERE id = $3`,
        [cancelledBy, reason, tripId]
      );

      // 🔔 NOTIFICACIÓN PUSH: Notificar a la otra parte
      const otherUserId =
        cancelledBy === 'passenger' ? trip.driver_id : trip.passenger_id;

      if (otherUserId) {
        await NotificationHelper.notifyTripCancelled({
          userId: otherUserId,
          tripId,
          cancelledBy,
          reason,
          io,
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Viaje cancelado',
        data: {
          tripId,
          status: 'cancelled',
          cancelledBy,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error cancelando viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/trips/:tripId
   * Obtener detalles de un viaje
   */
  static async getTripDetails(req: Request, res: Response) {
    const { tripId } = req.params;
    const userId = req.user.id;

    try {
      const tripResult = await pool.query(
        `SELECT t.*,
                p.first_name as passenger_first_name, p.last_name as passenger_last_name,
                p.phone as passenger_phone,
                d.first_name as driver_first_name, d.last_name as driver_last_name,
                d.phone as driver_phone
         FROM trips t
         LEFT JOIN users p ON t.passenger_id = p.id
         LEFT JOIN users d ON t.driver_id = d.id
         WHERE t.id = $1`,
        [tripId]
      );

      if (tripResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Viaje no encontrado',
          timestamp: new Date().toISOString(),
        });
      }

      const trip = tripResult.rows[0];

      // Verificar autorización (solo el pasajero, conductor o admin)
      if (
        trip.passenger_id !== userId &&
        trip.driver_id !== userId &&
        req.user.role !== 'admin'
      ) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado',
          timestamp: new Date().toISOString(),
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Detalles del viaje',
        data: trip,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error obteniendo detalles del viaje:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/trips/my-trips
   * Obtener historial de viajes del usuario
   */
  static async getMyTrips(req: Request, res: Response) {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
      const query =
        userRole === 'driver'
          ? 'SELECT * FROM trips WHERE driver_id = $1 ORDER BY requested_at DESC'
          : 'SELECT * FROM trips WHERE passenger_id = $1 ORDER BY requested_at DESC';

      const tripsResult = await pool.query(query, [userId]);

      const response: ApiResponse = {
        success: true,
        message: 'Historial de viajes',
        data: tripsResult.rows,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error obteniendo historial de viajes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
