import { FCMService } from '../services/fcm.service';
import { pool } from '../config/database';

/**
 * FASE 2: Helper de Notificaciones Push
 *
 * Centraliza los templates y lógica de envío de notificaciones
 * para diferentes eventos del sistema.
 */

interface NotificationData {
  type: string;
  [key: string]: any;
}

export class NotificationHelper {
  /**
   * Crea notificación en DB + envía push + emite WebSocket (si io está disponible)
   */
  private static async sendNotification({
    userId,
    title,
    body,
    notificationType,
    relatedTripId,
    data = {} as Record<string, any>,
    io,
  }: {
    userId: string;
    title: string;
    body: string;
    notificationType: string;
    relatedTripId?: string;
    data?: Record<string, any>;
    io?: any; // Socket.io instance (opcional)
  }): Promise<void> {
    try {
      // 1. Crear notificación en base de datos
      const notificationResult = await pool.query(
        `INSERT INTO notifications
         (user_id, title, message, notification_type, related_trip_id, data, is_push_sent)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id`,
        [userId, title, body, notificationType, relatedTripId, JSON.stringify(data)]
      );

      const notificationId = notificationResult.rows[0].id;

      // 2. Enviar push notification via FCM
      const result = await FCMService.sendToUser({
        userId,
        title,
        body,
        data: {
          notificationId,
          ...data,
          type: notificationType,
        },
        notificationId,
      });

      // 3. Actualizar estado de push en DB
      if (result.successCount > 0) {
        await pool.query(
          `UPDATE notifications
           SET is_push_sent = true, push_sent_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [notificationId]
        );
      }

      // 4. Emitir evento WebSocket si está disponible (para usuarios online)
      if (io) {
        io.to(`user_${userId}`).emit('notification', {
          id: notificationId,
          title,
          body,
          type: notificationType,
          data,
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`✅ Notificación enviada a usuario ${userId}: ${title}`);
    } catch (error) {
      console.error('❌ Error enviando notificación:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Notifica a múltiples usuarios (ej: todos los admins)
   */
  private static async sendToMultiple({
    userIds,
    title,
    body,
    notificationType,
    relatedTripId,
    data = {} as Record<string, any>,
    io,
  }: {
    userIds: string[];
    title: string;
    body: string;
    notificationType: string;
    relatedTripId?: string;
    data?: Record<string, any>;
    io?: any;
  }): Promise<void> {
    const promises = userIds.map(userId =>
      this.sendNotification({
        userId,
        title,
        body,
        notificationType,
        relatedTripId,
        data,
        io,
      })
    );

    await Promise.allSettled(promises);
  }

  // ========== TEMPLATES DE NOTIFICACIONES ==========

  /**
   * VIAJES: Nueva solicitud de viaje
   */
  static async notifyTripRequested({
    driverIds,
    passengerId,
    tripId,
    origin,
    destination,
    estimatedPrice,
    io,
  }: {
    driverIds: string[];
    passengerId: string;
    tripId: string;
    origin: string;
    destination: string;
    estimatedPrice: number;
    io?: any;
  }): Promise<void> {
    // Notificar a conductores disponibles
    await this.sendToMultiple({
      userIds: driverIds,
      title: '🚗 Nuevo Viaje Disponible',
      body: `De ${origin} a ${destination} - $${estimatedPrice.toFixed(2)}`,
      notificationType: 'trip_request',
      relatedTripId: tripId,
      data: {
        type: 'trip_request',
        tripId,
        passengerId,
        origin,
        destination,
        estimatedPrice,
      },
      io,
    });
  }

  /**
   * VIAJES: Conductor aceptó el viaje
   */
  static async notifyTripAccepted({
    passengerId,
    driverId,
    driverName,
    tripId,
    estimatedArrival,
    io,
  }: {
    passengerId: string;
    driverId: string;
    driverName: string;
    tripId: string;
    estimatedArrival?: number; // minutos
    io?: any;
  }): Promise<void> {
    const arrivalText = estimatedArrival
      ? ` - Llegada en ${estimatedArrival} min`
      : '';

    await this.sendNotification({
      userId: passengerId,
      title: '✅ Conductor Aceptó',
      body: `${driverName} aceptó tu viaje${arrivalText}`,
      notificationType: 'trip_accepted',
      relatedTripId: tripId,
      data: {
        type: 'trip_accepted',
        tripId,
        driverId,
        driverName,
        estimatedArrival,
      },
      io,
    });
  }

  /**
   * VIAJES: Conductor llegó al punto de recogida
   */
  static async notifyDriverArrived({
    passengerId,
    driverName,
    tripId,
    io,
  }: {
    passengerId: string;
    driverName: string;
    tripId: string;
    io?: any;
  }): Promise<void> {
    await this.sendNotification({
      userId: passengerId,
      title: '📍 Conductor Llegó',
      body: `${driverName} está esperándote`,
      notificationType: 'trip_accepted', // Usar el mismo tipo
      relatedTripId: tripId,
      data: {
        type: 'driver_arrived',
        tripId,
        driverName,
      },
      io,
    });
  }

  /**
   * VIAJES: Viaje iniciado
   */
  static async notifyTripStarted({
    passengerId,
    tripId,
    io,
  }: {
    passengerId: string;
    tripId: string;
    io?: any;
  }): Promise<void> {
    await this.sendNotification({
      userId: passengerId,
      title: '🚀 Viaje Iniciado',
      body: 'Tu viaje ha comenzado. ¡Buen viaje!',
      notificationType: 'trip_started',
      relatedTripId: tripId,
      data: {
        type: 'trip_started',
        tripId,
      },
      io,
    });
  }

  /**
   * VIAJES: Viaje completado
   */
  static async notifyTripCompleted({
    passengerId,
    driverId,
    tripId,
    fare,
    io,
  }: {
    passengerId: string;
    driverId: string;
    tripId: string;
    fare: number;
    io?: any;
  }): Promise<void> {
    // Notificar al pasajero
    await this.sendNotification({
      userId: passengerId,
      title: '✅ Viaje Completado',
      body: `Viaje finalizado - Total: $${fare.toFixed(2)}`,
      notificationType: 'trip_completed',
      relatedTripId: tripId,
      data: {
        type: 'trip_completed',
        tripId,
        fare,
      },
      io,
    });

    // Notificar al conductor
    await this.sendNotification({
      userId: driverId,
      title: '✅ Viaje Completado',
      body: `Ganancia del viaje: $${fare.toFixed(2)}`,
      notificationType: 'trip_completed',
      relatedTripId: tripId,
      data: {
        type: 'trip_completed',
        tripId,
        fare,
      },
      io,
    });
  }

  /**
   * VIAJES: Viaje cancelado
   */
  static async notifyTripCancelled({
    userId,
    tripId,
    cancelledBy,
    reason,
    io,
  }: {
    userId: string;
    tripId: string;
    cancelledBy: 'passenger' | 'driver';
    reason?: string;
    io?: any;
  }): Promise<void> {
    const byText = cancelledBy === 'passenger' ? 'el pasajero' : 'el conductor';
    const reasonText = reason ? ` - ${reason}` : '';

    await this.sendNotification({
      userId,
      title: '❌ Viaje Cancelado',
      body: `Viaje cancelado por ${byText}${reasonText}`,
      notificationType: 'trip_completed', // Usar el mismo tipo
      relatedTripId: tripId,
      data: {
        type: 'trip_cancelled',
        tripId,
        cancelledBy,
        reason,
      },
      io,
    });
  }

  /**
   * RESERVAS: Nueva reserva creada
   */
  static async notifyNewReservation({
    adminIds,
    reservationId,
    passengerName,
    scheduledDate,
    scheduledTime,
    serviceType,
    io,
  }: {
    adminIds: string[];
    reservationId: string;
    passengerName: string;
    scheduledDate: string;
    scheduledTime: string;
    serviceType: string;
    io?: any;
  }): Promise<void> {
    await this.sendToMultiple({
      userIds: adminIds,
      title: '📅 Nueva Reserva',
      body: `${passengerName} - ${serviceType} para ${scheduledDate} ${scheduledTime}`,
      notificationType: 'reservation_reminder',
      data: {
        type: 'new_reservation',
        reservationId,
        passengerName,
        scheduledDate,
        scheduledTime,
        serviceType,
      },
      io,
    });
  }

  /**
   * RESERVAS: Conductor asignado
   */
  static async notifyReservationAssigned({
    passengerId,
    driverId,
    driverName,
    reservationId,
    scheduledDate,
    scheduledTime,
    io,
  }: {
    passengerId: string;
    driverId: string;
    driverName: string;
    reservationId: string;
    scheduledDate: string;
    scheduledTime: string;
    io?: any;
  }): Promise<void> {
    // Notificar al pasajero
    await this.sendNotification({
      userId: passengerId,
      title: '✅ Conductor Asignado',
      body: `${driverName} fue asignado para tu reserva del ${scheduledDate}`,
      notificationType: 'reservation_reminder',
      data: {
        type: 'reservation_assigned',
        reservationId,
        driverId,
        driverName,
        scheduledDate,
        scheduledTime,
      },
      io,
    });

    // Notificar al conductor
    await this.sendNotification({
      userId: driverId,
      title: '📅 Reserva Asignada',
      body: `Tienes una reserva para ${scheduledDate} a las ${scheduledTime}`,
      notificationType: 'reservation_reminder',
      data: {
        type: 'reservation_assigned',
        reservationId,
        scheduledDate,
        scheduledTime,
      },
      io,
    });
  }

  /**
   * RUTA: Cambio de ruta solicitado
   */
  static async notifyRouteChange({
    passengerId,
    tripId,
    reason,
    io,
  }: {
    passengerId: string;
    tripId: string;
    reason: string;
    io?: any;
  }): Promise<void> {
    await this.sendNotification({
      userId: passengerId,
      title: '🗺️ Cambio de Ruta',
      body: `Tu conductor solicita cambiar ruta: ${reason}`,
      notificationType: 'route_change_request',
      relatedTripId: tripId,
      data: {
        type: 'route_change',
        tripId,
        reason,
      },
      io,
    });
  }

  /**
   * PÁNICO: Alerta de pánico activada
   */
  static async notifyPanicAlert({
    adminIds,
    userId,
    userName,
    tripId,
    coordinates,
    alertType,
    io,
  }: {
    adminIds: string[];
    userId: string;
    userName: string;
    tripId?: string;
    coordinates?: { lat: number; lng: number };
    alertType: 'volume_button' | 'manual';
    io?: any;
  }): Promise<void> {
    const alertText = alertType === 'volume_button' ? 'por volumen' : 'manualmente';

    await this.sendToMultiple({
      userIds: adminIds,
      title: '🚨 ALERTA DE PÁNICO',
      body: `${userName} activó pánico ${alertText}`,
      notificationType: 'panic_alert',
      relatedTripId: tripId,
      data: {
        type: 'panic_alert',
        userId,
        userName,
        tripId,
        coordinates,
        alertType,
      },
      io,
    });
  }

  /**
   * PAGOS: Pago confirmado
   */
  static async notifyPaymentConfirmed({
    userId,
    tripId,
    amount,
    io,
  }: {
    userId: string;
    tripId?: string;
    amount: number;
    io?: any;
  }): Promise<void> {
    await this.sendNotification({
      userId,
      title: '✅ Pago Confirmado',
      body: `Tu pago de $${amount.toFixed(2)} ha sido procesado`,
      notificationType: 'payment_received',
      relatedTripId: tripId,
      data: {
        type: 'payment_confirmed',
        amount,
        tripId,
      },
      io,
    });
  }

  /**
   * PAGOS: Pago fallido
   */
  static async notifyPaymentFailed({
    userId,
    tripId,
    amount,
    reason,
    io,
  }: {
    userId: string;
    tripId?: string;
    amount: number;
    reason?: string;
    io?: any;
  }): Promise<void> {
    const reasonText = reason ? ` - ${reason}` : '';

    await this.sendNotification({
      userId,
      title: '❌ Pago Fallido',
      body: `No se pudo procesar tu pago de $${amount.toFixed(2)}${reasonText}`,
      notificationType: 'payment_received',
      relatedTripId: tripId,
      data: {
        type: 'payment_failed',
        amount,
        reason,
        tripId,
      },
      io,
    });
  }

  /**
   * Helper: Obtener IDs de todos los admins
   */
  static async getAdminIds(): Promise<string[]> {
    const result = await pool.query(
      `SELECT id FROM users WHERE role = 'admin' AND status = 'active'`
    );
    return result.rows.map(row => row.id);
  }

  /**
   * Helper: Obtener conductores disponibles cerca de una ubicación
   */
  static async getAvailableDriverIds(coordinates?: {
    lat: number;
    lng: number;
  }): Promise<string[]> {
    // TODO: Implementar lógica de proximidad geográfica
    // Por ahora retorna todos los conductores activos disponibles
    const result = await pool.query(
      `SELECT id FROM users
       WHERE role = 'driver'
       AND status = 'active'`
    );
    return result.rows.map(row => row.id);
  }
}
