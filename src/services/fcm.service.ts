import * as admin from 'firebase-admin';
import { pool } from '../config/database';

/**
 * FASE 1: Servicio de Firebase Cloud Messaging
 *
 * Este servicio maneja:
 * - Inicialización de Firebase Admin SDK
 * - Registro y eliminación de tokens FCM
 * - Envío de notificaciones push a usuarios
 * - Logging de notificaciones enviadas
 */
export class FCMService {
  private static isInitialized = false;

  /**
   * Inicializa Firebase Admin SDK
   * Se ejecuta al arrancar el servidor
   */
  static async initialize() {
    if (this.isInitialized) {
      console.log('⚠️  Firebase Admin ya está inicializado');
      return;
    }

    try {
      // Verificar que exista la service account key
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

      if (!serviceAccountPath) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH no está definido en .env');
      }

      // Inicializar Firebase Admin
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      this.isInitialized = true;
      console.log('✅ Firebase Admin SDK inicializado');
    } catch (error) {
      console.error('❌ Error inicializando Firebase Admin:', error);
      throw error;
    }
  }

  /**
   * Registra un token FCM para un usuario
   */
  static async registerToken({
    userId,
    fcmToken,
    deviceType,
    deviceName,
    deviceId,
  }: {
    userId: string;
    fcmToken: string;
    deviceType: 'android' | 'ios' | 'web';
    deviceName?: string;
    deviceId?: string;
  }): Promise<void> {
    try {
      // Desactivar tokens antiguos del mismo dispositivo
      if (deviceId) {
        await pool.query(
          `UPDATE user_fcm_tokens
           SET is_active = false
           WHERE user_id = $1 AND device_id = $2`,
          [userId, deviceId]
        );
      }

      // Insertar nuevo token (o actualizar si ya existe)
      await pool.query(
        `INSERT INTO user_fcm_tokens (
          user_id, fcm_token, device_type, device_name, device_id, is_active, last_used_at
        ) VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
        ON CONFLICT (fcm_token)
        DO UPDATE SET
          is_active = true,
          last_used_at = CURRENT_TIMESTAMP,
          device_name = EXCLUDED.device_name,
          device_id = EXCLUDED.device_id,
          updated_at = CURRENT_TIMESTAMP`,
        [userId, fcmToken, deviceType, deviceName, deviceId]
      );

      console.log(`✅ Token FCM registrado para usuario ${userId}`);
    } catch (error) {
      console.error('❌ Error registrando token FCM:', error);
      throw error;
    }
  }

  /**
   * Elimina un token FCM (cuando el usuario cierra sesión o desinstala la app)
   */
  static async removeToken(fcmToken: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE user_fcm_tokens
         SET is_active = false
         WHERE fcm_token = $1`,
        [fcmToken]
      );

      console.log(`✅ Token FCM desactivado`);
    } catch (error) {
      console.error('❌ Error removiendo token FCM:', error);
      throw error;
    }
  }

  /**
   * Envía una notificación push a un usuario específico
   * Soporta múltiples dispositivos (envía a todos los tokens activos)
   */
  static async sendToUser({
    userId,
    title,
    body,
    data = {},
    notificationId,
  }: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    notificationId?: string;
  }): Promise<{ successCount: number; failureCount: number }> {
    try {
      // Obtener todos los tokens activos del usuario
      const result = await pool.query(
        `SELECT fcm_token, device_type
         FROM user_fcm_tokens
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      const tokens = result.rows;

      if (tokens.length === 0) {
        console.log(`⚠️  Usuario ${userId} no tiene tokens FCM activos`);
        return { successCount: 0, failureCount: 0 };
      }

      // Preparar mensaje
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          notificationId: notificationId || '',
          userId,
        },
        tokens: tokens.map(t => t.fcm_token),
        android: {
          priority: 'high',
          notification: {
            channelId: 'blincar_high_importance',
            priority: 'high',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // Enviar notificación
      const response = await admin.messaging().sendEachForMulticast(message);

      // Procesar resultados y logging
      await this.processResults({
        userId,
        tokens,
        responses: response.responses,
        notificationId,
      });

      console.log(
        `✅ Notificación enviada a usuario ${userId}: ${response.successCount} exitosas, ${response.failureCount} fallidas`
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('❌ Error enviando notificación:', error);
      throw error;
    }
  }

  /**
   * Envía notificaciones a múltiples usuarios
   */
  static async sendToMultipleUsers({
    userIds,
    title,
    body,
    data = {},
    notificationId,
  }: {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
    notificationId?: string;
  }): Promise<{ successCount: number; failureCount: number }> {
    let totalSuccess = 0;
    let totalFailure = 0;

    // Enviar a cada usuario (en paralelo)
    const promises = userIds.map(userId =>
      this.sendToUser({ userId, title, body, data, notificationId })
    );

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        totalSuccess += result.value.successCount;
        totalFailure += result.value.failureCount;
      } else {
        totalFailure++;
      }
    });

    return { successCount: totalSuccess, failureCount: totalFailure };
  }

  /**
   * Procesa resultados del envío y guarda logs
   */
  private static async processResults({
    userId,
    tokens,
    responses,
    notificationId,
  }: {
    userId: string;
    tokens: { fcm_token: string; device_type: string }[];
    responses: admin.messaging.SendResponse[];
    notificationId?: string;
  }): Promise<void> {
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const token = tokens[i].fcm_token;

      if (response.success) {
        // Log exitoso
        await pool.query(
          `INSERT INTO notification_logs (
            notification_id, user_id, fcm_token, send_status, sent_at
          ) VALUES ($1, $2, $3, 'sent', CURRENT_TIMESTAMP)`,
          [notificationId, userId, token]
        );
      } else {
        const error = response.error;
        let status: 'failed' | 'invalid_token' = 'failed';

        // Si el token es inválido, marcarlo como inactivo
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          status = 'invalid_token';
          await pool.query(
            `UPDATE user_fcm_tokens
             SET is_active = false
             WHERE fcm_token = $1`,
            [token]
          );
          console.log(`⚠️  Token FCM marcado como inválido: ${token.substring(0, 20)}...`);
        }

        // Log de error
        await pool.query(
          `INSERT INTO notification_logs (
            notification_id, user_id, fcm_token, send_status, error_message
          ) VALUES ($1, $2, $3, $4, $5)`,
          [notificationId, userId, token, status, error?.message || 'Unknown error']
        );
      }
    }
  }

  /**
   * Obtiene estadísticas de notificaciones de un usuario
   */
  static async getUserNotificationStats(userId: string): Promise<{
    totalSent: number;
    totalFailed: number;
    activeTokens: number;
  }> {
    const [logsResult, tokensResult] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE send_status = 'sent') as sent,
          COUNT(*) FILTER (WHERE send_status IN ('failed', 'invalid_token')) as failed
         FROM notification_logs
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) as active
         FROM user_fcm_tokens
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      ),
    ]);

    return {
      totalSent: parseInt(logsResult.rows[0]?.sent || '0'),
      totalFailed: parseInt(logsResult.rows[0]?.failed || '0'),
      activeTokens: parseInt(tokensResult.rows[0]?.active || '0'),
    };
  }
}
