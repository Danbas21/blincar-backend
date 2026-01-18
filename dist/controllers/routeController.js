"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteController = void 0;
const database_1 = require("../config/database");
const index_1 = require("../index");
class RouteController {
    // Solicitar cambio de ruta dinámico
    static async requestRouteChange(req, res) {
        const { tripId, originalRoute, newRoute, reason } = req.body;
        const driverId = req.user.id;
        try {
            // Obtener información del viaje y pasajero
            const tripResult = await database_1.pool.query(`
        SELECT passenger_id, status FROM trips WHERE id = $1 AND driver_id = $2
      `, [tripId, driverId]);
            if (tripResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Viaje no encontrado o no autorizado',
                    timestamp: new Date().toISOString()
                });
            }
            if (tripResult.rows[0].status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    message: 'Solo se pueden cambiar rutas en viajes en progreso',
                    timestamp: new Date().toISOString()
                });
            }
            const passengerId = tripResult.rows[0].passenger_id;
            // Insertar solicitud de cambio de ruta
            const routeChangeResult = await database_1.pool.query(`
        INSERT INTO route_changes 
        (trip_id, driver_id, original_route, new_route, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [tripId, driverId, JSON.stringify(originalRoute), JSON.stringify(newRoute), reason]);
            // Actualizar contador en trip
            await database_1.pool.query(`
        UPDATE trips SET route_changes_count = route_changes_count + 1 
        WHERE id = $1
      `, [tripId]);
            // Notificar al pasajero en tiempo real
            index_1.io.to(`user_${passengerId}`).emit('route_change_request', {
                routeChangeId: routeChangeResult.rows[0].id,
                tripId,
                reason,
                newRoute,
                timestamp: new Date().toISOString()
            });
            // Crear notificación para el pasajero
            await database_1.pool.query(`
        INSERT INTO notifications 
        (user_id, title, message, notification_type, related_trip_id, data)
        VALUES ($1, 'Cambio de Ruta Solicitado', $2, 'route_change_request', $3, $4)
      `, [
                passengerId,
                `Tu conductor solicita cambiar la ruta: ${reason}`,
                tripId,
                JSON.stringify({ routeChangeId: routeChangeResult.rows[0].id, reason })
            ]);
            const response = {
                success: true,
                message: 'Solicitud de cambio de ruta enviada al pasajero',
                data: { routeChangeId: routeChangeResult.rows[0].id },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error solicitando cambio de ruta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Responder a solicitud de cambio de ruta (pasajero)
    static async respondToRouteChange(req, res) {
        const { routeChangeId } = req.params;
        const { approved } = req.body;
        const passengerId = req.user.id;
        try {
            // Verificar que la solicitud existe y pertenece al pasajero
            const routeChangeResult = await database_1.pool.query(`
        SELECT rc.*, t.driver_id 
        FROM route_changes rc
        JOIN trips t ON rc.trip_id = t.id
        WHERE rc.id = $1 AND t.passenger_id = $2 AND rc.passenger_approval_status = 'pending'
      `, [routeChangeId, passengerId]);
            if (routeChangeResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Solicitud de cambio de ruta no encontrada',
                    timestamp: new Date().toISOString()
                });
            }
            const routeChange = routeChangeResult.rows[0];
            const status = approved ? 'approved' : 'rejected';
            // Actualizar estado de la solicitud
            await database_1.pool.query(`
        UPDATE route_changes 
        SET passenger_approval_status = $1, passenger_response_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [status, routeChangeId]);
            // Si fue rechazada, notificar al administrador
            if (!approved) {
                await database_1.pool.query(`
          UPDATE route_changes SET admin_notified = true WHERE id = $1
        `, [routeChangeId]);
                // Crear notificación para administradores
                await database_1.pool.query(`
          INSERT INTO notifications (user_id, title, message, notification_type, related_trip_id, data)
          SELECT id, 'Cambio de Ruta Rechazado', 
                 'Pasajero rechazó cambio de ruta solicitado por conductor',
                 'route_change_request', $1, $2
          FROM users WHERE role = 'admin'
        `, [routeChange.trip_id, JSON.stringify({ routeChangeId, status: 'rejected' })]);
            }
            // Notificar al conductor
            index_1.io.to(`user_${routeChange.driver_id}`).emit('route_change_response', {
                routeChangeId,
                approved,
                timestamp: new Date().toISOString()
            });
            const response = {
                success: true,
                message: `Cambio de ruta ${approved ? 'aprobado' : 'rechazado'}`,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error respondiendo cambio de ruta:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Obtener solicitudes de cambio de ruta pendientes (admin)
    static async getPendingRouteChanges(req, res) {
        try {
            const routeChangesResult = await database_1.pool.query(`
        SELECT rc.*, 
               t.origin_address, t.destination_address,
               u.first_name as passenger_name, u.last_name as passenger_lastname,
               d.first_name as driver_name, d.last_name as driver_lastname
        FROM route_changes rc
        JOIN trips t ON rc.trip_id = t.id
        JOIN users u ON t.passenger_id = u.id
        JOIN users d ON rc.driver_id = d.id
        WHERE rc.passenger_approval_status = 'rejected' AND rc.admin_notified = true
        ORDER BY rc.created_at DESC
      `);
            const response = {
                success: true,
                message: 'Cambios de ruta pendientes obtenidos',
                data: routeChangesResult.rows,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error obteniendo cambios de ruta pendientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
}
exports.RouteController = RouteController;
