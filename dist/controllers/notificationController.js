"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const database_1 = require("../config/database");
const index_1 = require("../index");
class NotificationController {
    // Crear notificación
    static async createNotification(req, res) {
        const { userId, title, message, notificationType, relatedTripId, data } = req.body;
        try {
            const notificationResult = await database_1.pool.query(`
        INSERT INTO notifications 
        (user_id, title, message, notification_type, related_trip_id, data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [userId, title, message, notificationType, relatedTripId, JSON.stringify(data)]);
            // Enviar notificación en tiempo real via WebSocket
            index_1.io.to(`user_${userId}`).emit('new_notification', {
                id: notificationResult.rows[0].id,
                title,
                message,
                type: notificationType,
                timestamp: new Date().toISOString()
            });
            // TODO: Enviar push notification via Firebase
            console.log(`Push notification enviada a usuario ${userId}: ${title}`);
            const response = {
                success: true,
                message: 'Notificación enviada',
                data: { notificationId: notificationResult.rows[0].id },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creando notificación:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Obtener notificaciones del usuario
    static async getUserNotifications(req, res) {
        const userId = req.user.id;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        try {
            let query = `
        SELECT * FROM notifications 
        WHERE user_id = $1
      `;
            const params = [userId];
            if (unreadOnly === 'true') {
                query += ` AND is_read = false`;
            }
            query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, ((Number(page) - 1) * Number(limit)).toString());
            const notificationsResult = await database_1.pool.query(query, params);
            // Contar total de notificaciones no leídas
            const unreadCountResult = await database_1.pool.query(`
        SELECT COUNT(*) as unread_count 
        FROM notifications 
        WHERE user_id = $1 AND is_read = false
      `, [userId]);
            const response = {
                success: true,
                message: 'Notificaciones obtenidas',
                data: {
                    notifications: notificationsResult.rows,
                    unreadCount: parseInt(unreadCountResult.rows[0].unread_count),
                    page: Number(page),
                    limit: Number(limit)
                },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error obteniendo notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Marcar notificación como leída
    static async markAsRead(req, res) {
        const { notificationId } = req.params;
        const userId = req.user.id;
        try {
            const result = await database_1.pool.query(`
        UPDATE notifications 
        SET is_read = true 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [notificationId, userId]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada',
                    timestamp: new Date().toISOString()
                });
            }
            res.status(200).json({
                success: true,
                message: 'Notificación marcada como leída',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Error marcando notificación como leída:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Marcar todas las notificaciones como leídas
    static async markAllAsRead(req, res) {
        const userId = req.user.id;
        try {
            const result = await database_1.pool.query(`
        UPDATE notifications 
        SET is_read = true 
        WHERE user_id = $1 AND is_read = false
        RETURNING id
      `, [userId]);
            res.status(200).json({
                success: true,
                message: `${result.rows.length} notificaciones marcadas como leídas`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Error marcando todas las notificaciones como leídas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
}
exports.NotificationController = NotificationController;
