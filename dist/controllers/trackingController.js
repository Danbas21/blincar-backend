"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingController = void 0;
const database_1 = require("../config/database");
const index_1 = require("../index");
class TrackingController {
    // Actualizar ubicación en tiempo real
    static async updateLocation(req, res) {
        const { tripId, coordinates, speed, heading, accuracy } = req.body;
        const userId = req.user.id;
        try {
            // Insertar actualización de ubicación
            await database_1.pool.query(`
        INSERT INTO location_updates 
        (trip_id, user_id, coordinates, speed, heading, accuracy)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [tripId, userId, JSON.stringify(coordinates), speed, heading, accuracy]);
            // Actualizar ubicación actual del conductor si es conductor
            const userResult = await database_1.pool.query(`
        SELECT role FROM users WHERE id = $1
      `, [userId]);
            if (userResult.rows[0]?.role === 'driver') {
                await database_1.pool.query(`
          UPDATE drivers 
          SET current_location = $1
          WHERE user_id = $2
        `, [JSON.stringify(coordinates), userId]);
            }
            // Enviar ubicación en tiempo real
            if (tripId) {
                // Obtener información del viaje para saber a quién notificar
                const tripResult = await database_1.pool.query(`
          SELECT passenger_id, driver_id FROM trips WHERE id = $1
        `, [tripId]);
                if (tripResult.rows.length > 0) {
                    const { passenger_id, driver_id } = tripResult.rows[0];
                    // Notificar al otro participante del viaje
                    const targetUser = userId === passenger_id ? driver_id : passenger_id;
                    if (targetUser) {
                        index_1.io.to(`user_${targetUser}`).emit('location_update', {
                            tripId,
                            userId,
                            coordinates,
                            speed,
                            heading,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
            // Siempre notificar a administradores si es conductor
            if (userResult.rows[0]?.role === 'driver') {
                index_1.io.emit('driver_location_update', {
                    driverId: userId,
                    coordinates,
                    tripId,
                    hasActiveTrip: !!tripId,
                    timestamp: new Date().toISOString()
                });
            }
            res.status(200).json({
                success: true,
                message: 'Ubicación actualizada',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Error actualizando ubicación:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Obtener historial de ubicaciones de un viaje
    static async getTripLocationHistory(req, res) {
        const { tripId } = req.params;
        try {
            const locationsResult = await database_1.pool.query(`
        SELECT lu.*, u.role, u.first_name, u.last_name
        FROM location_updates lu
        JOIN users u ON lu.user_id = u.id
        WHERE lu.trip_id = $1
        ORDER BY lu.timestamp ASC
      `, [tripId]);
            const response = {
                success: true,
                message: 'Historial de ubicaciones obtenido',
                data: locationsResult.rows,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error obteniendo historial de ubicaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Obtener conductores disponibles cerca (para admin)
    static async getNearbyDrivers(req, res) {
        const { latitude, longitude, radiusKm = 5 } = req.query;
        try {
            // Query básico - en producción usaríamos PostGIS para cálculos geoespaciales precisos
            const driversResult = await database_1.pool.query(`
        SELECT d.*, u.first_name, u.last_name, u.phone,
               v.make, v.model, v.license_plate
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
        WHERE d.status = 'available' AND d.current_location IS NOT NULL
      `);
            // Filtrar por distancia (implementación simplificada)
            const nearbyDrivers = driversResult.rows.filter(driver => {
                if (!driver.current_location)
                    return false;
                const driverCoords = typeof driver.current_location === 'string'
                    ? JSON.parse(driver.current_location)
                    : driver.current_location;
                // Cálculo básico de distancia (en producción usar fórmula de Haversine)
                const latDiff = Math.abs(driverCoords.latitude - parseFloat(latitude));
                const lngDiff = Math.abs(driverCoords.longitude - parseFloat(longitude));
                const approximateDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Aproximación en km
                return approximateDistance <= parseFloat(radiusKm);
            });
            const response = {
                success: true,
                message: 'Conductores cercanos obtenidos',
                data: nearbyDrivers,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error obteniendo conductores cercanos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
}
exports.TrackingController = TrackingController;
