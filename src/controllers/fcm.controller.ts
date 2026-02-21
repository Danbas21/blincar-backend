import { Request, Response } from 'express';
import { FCMService } from '../services/fcm.service';

/**
 * Controlador para endpoints de FCM
 */
export class FCMController {
  /**
   * POST /api/fcm/register
   * Registra el token FCM del dispositivo del usuario
   */
  static async registerToken(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId; // Del middleware authenticateToken

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const { fcmToken, deviceType, deviceName, deviceId } = req.body;

      // Validación
      if (!fcmToken) {
        return res.status(400).json({ error: 'fcmToken es requerido' });
      }

      if (!deviceType || !['android', 'ios', 'web'].includes(deviceType)) {
        return res.status(400).json({
          error: 'deviceType debe ser android, ios o web',
        });
      }

      // Registrar token
      await FCMService.registerToken({
        userId,
        fcmToken,
        deviceType,
        deviceName,
        deviceId,
      });

      res.status(200).json({
        message: 'Token FCM registrado exitosamente',
        userId,
      });
    } catch (error: any) {
      console.error('Error en registerToken:', error);
      res.status(500).json({
        error: 'Error registrando token FCM',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/fcm/remove
   * Elimina el token FCM (cuando el usuario cierra sesión)
   */
  static async removeToken(req: Request, res: Response) {
    try {
      const { fcmToken } = req.body;

      if (!fcmToken) {
        return res.status(400).json({ error: 'fcmToken es requerido' });
      }

      await FCMService.removeToken(fcmToken);

      res.status(200).json({
        message: 'Token FCM eliminado exitosamente',
      });
    } catch (error: any) {
      console.error('Error en removeToken:', error);
      res.status(500).json({
        error: 'Error eliminando token FCM',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/fcm/stats
   * Obtiene estadísticas de notificaciones del usuario (para debugging)
   */
  static async getStats(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const stats = await FCMService.getUserNotificationStats(userId);

      res.status(200).json({
        userId,
        stats,
      });
    } catch (error: any) {
      console.error('Error en getStats:', error);
      res.status(500).json({
        error: 'Error obteniendo estadísticas',
        details: error.message,
      });
    }
  }
}
