import { Request, Response } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../types';

export class ReservationController {
  
  // Crear reserva de viaje
  static async createReservation(req: Request, res: Response) {
    const {
      serviceTypeId,
      scheduledDate,
      scheduledTime,
      durationType,
      durationValue,
      originAddress,
      destinationAddress,
      originCoordinates,
      destinationCoordinates,
      specialRequirements
    } = req.body;
    const passengerId = req.user.id;

    try {
      // Obtener precio del tipo de servicio
      const serviceResult = await pool.query(`
        SELECT * FROM service_types WHERE id = $1 AND is_active = true
      `, [serviceTypeId]);

      if (serviceResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tipo de servicio no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      const service = serviceResult.rows[0];
      
      // Calcular precio estimado
      let estimatedPrice = parseFloat(service.base_price);
      
      if (durationType === 'hours' && durationValue) {
        estimatedPrice += parseFloat(service.price_per_hour) * durationValue;
      } else if (durationType === 'days' && durationValue) {
        estimatedPrice += parseFloat(service.price_per_day) * durationValue;
      }

      // Crear reserva
      const reservationResult = await pool.query(`
        INSERT INTO trip_reservations 
        (passenger_id, service_type_id, scheduled_date, scheduled_time, duration_type, 
         duration_value, origin_address, destination_address, origin_coordinates, 
         destination_coordinates, estimated_price, special_requirements)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        passengerId, serviceTypeId, scheduledDate, scheduledTime, durationType,
        durationValue, originAddress, destinationAddress, 
        JSON.stringify(originCoordinates), JSON.stringify(destinationCoordinates),
        estimatedPrice, specialRequirements
      ]);

      const response: ApiResponse = {
        success: true,
        message: 'Reserva creada exitosamente',
        data: {
          reservationId: reservationResult.rows[0].id,
          estimatedPrice,
          status: 'pending'
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error creando reserva:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Obtener reservas del usuario
  static async getUserReservations(req: Request, res: Response) {
    const userId = req.user.id;

    try {
      const reservationsResult = await pool.query(`
        SELECT tr.*, st.name as service_name, st.description as service_description
        FROM trip_reservations tr
        JOIN service_types st ON tr.service_type_id = st.id
        WHERE tr.passenger_id = $1
        ORDER BY tr.scheduled_date DESC, tr.scheduled_time DESC
      `, [userId]);

      const response: ApiResponse = {
        success: true,
        message: 'Reservas obtenidas',
        data: reservationsResult.rows,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error obteniendo reservas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Asignar conductor a reserva (para admin o conductor)
  static async assignDriverToReservation(req: Request, res: Response) {
    const { reservationId } = req.params;
    const { driverId } = req.body;

    try {
      // Verificar disponibilidad del conductor en la fecha
      const conflictResult = await pool.query(`
        SELECT id FROM trip_reservations 
        WHERE assigned_driver_id = $1 
        AND scheduled_date = (SELECT scheduled_date FROM trip_reservations WHERE id = $2)
        AND status IN ('confirmed', 'assigned')
      `, [driverId, reservationId]);

      if (conflictResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'El conductor no está disponible en esa fecha',
          timestamp: new Date().toISOString()
        });
      }

      // Asignar conductor
      await pool.query(`
        UPDATE trip_reservations 
        SET assigned_driver_id = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [driverId, reservationId]);

      const response: ApiResponse = {
        success: true,
        message: 'Conductor asignado a la reserva',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error asignando conductor:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }
} 
