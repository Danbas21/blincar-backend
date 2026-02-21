 
import { Request, Response } from 'express';
import { pool } from '../config/database';
import { ApiResponse } from '../types';
import { io } from '../index';
import { NotificationHelper } from '../helpers/notification.helper';

export class RouteController {

  // Proxy para Google Directions API
  // Esta ruta permite que la app móvil use el API key restringido por IP del backend
  static async getDirections(req: Request, res: Response) {
    const { originLat, originLng, destinationLat, destinationLng } = req.query;

    // Validar parámetros
    if (!originLat || !originLng || !destinationLat || !destinationLng) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren originLat, originLng, destinationLat, destinationLng',
        timestamp: new Date().toISOString()
      });
    }

    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Google Maps no configurada',
          timestamp: new Date().toISOString()
        });
      }

      const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
      url.searchParams.set('origin', `${originLat},${originLng}`);
      url.searchParams.set('destination', `${destinationLat},${destinationLng}`);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('mode', 'driving');
      url.searchParams.set('language', 'es');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: any = await response.json();

      if (data.status !== 'OK') {
        console.error('Google Directions API error:', data.status, data.error_message);
        return res.status(400).json({
          success: false,
          message: `Error de Google Maps: ${data.status}`,
          error: data.error_message,
          timestamp: new Date().toISOString()
        });
      }

      const routes = data.routes;
      if (!routes || routes.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron rutas',
          timestamp: new Date().toISOString()
        });
      }

      const leg = routes[0].legs[0];
      const duration = leg.duration;
      const distance = leg.distance;

      const result: ApiResponse = {
        success: true,
        message: 'Ruta calculada correctamente',
        data: {
          durationMinutes: Math.ceil(duration.value / 60),
          distanceKm: distance.value / 1000,
          durationText: duration.text,
          distanceText: distance.text,
          isApproximate: false
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error obteniendo direcciones:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error calculando ruta',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Proxy para Google Geocoding reverso (coordenadas → dirección)
  static async reverseGeocode(req: Request, res: Response) {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren lat y lng',
        timestamp: new Date().toISOString()
      });
    }

    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, message: 'API Key no configurada', timestamp: new Date().toISOString() });
      }

      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('language', 'es');
      url.searchParams.set('region', 'mx');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      const data: any = await response.json();

      if (data.status !== 'OK' || !data.results?.length) {
        return res.status(200).json({ success: false, message: 'Sin resultados', timestamp: new Date().toISOString() });
      }

      res.status(200).json({
        success: true,
        message: 'Dirección obtenida',
        data: { formattedAddress: data.results[0].formatted_address },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Error en geocoding', error: error.message, timestamp: new Date().toISOString() });
    }
  }

  // Proxy para Google Places Autocomplete API
  // Restringe resultados a México (components=country:mx)
  static async getPlacesAutocomplete(req: Request, res: Response) {
    const { input } = req.query;

    if (!input || typeof input !== 'string' || input.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el parámetro input con al menos 2 caracteres',
        timestamp: new Date().toISOString()
      });
    }

    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Google Maps no configurada',
          timestamp: new Date().toISOString()
        });
      }

      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input.trim());
      url.searchParams.set('key', apiKey);
      url.searchParams.set('language', 'es');
      url.searchParams.set('components', 'country:mx');
      url.searchParams.set('location', '19.4326,-99.1332');
      url.searchParams.set('radius', '50000');
      url.searchParams.set('strictbounds', 'false');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: any = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return res.status(400).json({
          success: false,
          message: `Error de Google Places: ${data.status}`,
          error: data.error_message,
          timestamp: new Date().toISOString()
        });
      }

      const predictions = (data.predictions || []).map((p: any) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
        fullDescription: p.description,
      }));

      res.status(200).json({
        success: true,
        message: 'Sugerencias obtenidas',
        data: { predictions },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error en Places Autocomplete:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo sugerencias de lugares',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Proxy para Google Place Details API (obtiene coordenadas de un placeId)
  static async getPlaceDetails(req: Request, res: Response) {
    const { placeId } = req.query;

    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el parámetro placeId',
        timestamp: new Date().toISOString()
      });
    }

    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Google Maps no configurada',
          timestamp: new Date().toISOString()
        });
      }

      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('fields', 'geometry,formatted_address,name');
      url.searchParams.set('language', 'es');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: any = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({
          success: false,
          message: `Error de Google Places: ${data.status}`,
          error: data.error_message,
          timestamp: new Date().toISOString()
        });
      }

      const result = data.result;
      const location = result?.geometry?.location;

      res.status(200).json({
        success: true,
        message: 'Detalles del lugar obtenidos',
        data: {
          lat: location?.lat,
          lng: location?.lng,
          formattedAddress: result?.formatted_address || '',
          name: result?.name || '',
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error en Place Details:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo detalles del lugar',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Solicitar cambio de ruta dinámico
  static async requestRouteChange(req: Request, res: Response) {
    const { tripId, originalRoute, newRoute, reason } = req.body;
    const driverId = req.user.id;

    try {
      // Obtener información del viaje y pasajero
      const tripResult = await pool.query(`
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
      const routeChangeResult = await pool.query(`
        INSERT INTO route_changes 
        (trip_id, driver_id, original_route, new_route, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [tripId, driverId, JSON.stringify(originalRoute), JSON.stringify(newRoute), reason]);

      // Actualizar contador en trip
      await pool.query(`
        UPDATE trips SET route_changes_count = route_changes_count + 1 
        WHERE id = $1
      `, [tripId]);

      // 🔔 NOTIFICACIÓN PUSH: Notificar al pasajero sobre cambio de ruta
      await NotificationHelper.notifyRouteChange({
        passengerId,
        tripId,
        reason,
        io,
      });

      // También emitir evento WebSocket para usuarios online
      io.to(`user_${passengerId}`).emit('route_change_request', {
        routeChangeId: routeChangeResult.rows[0].id,
        tripId,
        reason,
        newRoute,
        timestamp: new Date().toISOString()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Solicitud de cambio de ruta enviada al pasajero',
        data: { routeChangeId: routeChangeResult.rows[0].id },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error solicitando cambio de ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Responder a solicitud de cambio de ruta (pasajero)
  static async respondToRouteChange(req: Request, res: Response) {
    const { routeChangeId } = req.params;
    const { approved } = req.body;
    const passengerId = req.user.id;

    try {
      // Verificar que la solicitud existe y pertenece al pasajero
      const routeChangeResult = await pool.query(`
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
      await pool.query(`
        UPDATE route_changes 
        SET passenger_approval_status = $1, passenger_response_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [status, routeChangeId]);

      // Si fue rechazada, notificar al administrador
      if (!approved) {
        await pool.query(`
          UPDATE route_changes SET admin_notified = true WHERE id = $1
        `, [routeChangeId]);

        // Crear notificación para administradores
        await pool.query(`
          INSERT INTO notifications (user_id, title, message, notification_type, related_trip_id, data)
          SELECT id, 'Cambio de Ruta Rechazado', 
                 'Pasajero rechazó cambio de ruta solicitado por conductor',
                 'route_change_request', $1, $2
          FROM users WHERE role = 'admin'
        `, [routeChange.trip_id, JSON.stringify({ routeChangeId, status: 'rejected' })]);
      }

      // Notificar al conductor
      io.to(`user_${routeChange.driver_id}`).emit('route_change_response', {
        routeChangeId,
        approved,
        timestamp: new Date().toISOString()
      });

      const response: ApiResponse = {
        success: true,
        message: `Cambio de ruta ${approved ? 'aprobado' : 'rechazado'}`,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error respondiendo cambio de ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Obtener solicitudes de cambio de ruta pendientes (admin)
  static async getPendingRouteChanges(req: Request, res: Response) {
    try {
      const routeChangesResult = await pool.query(`
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

      const response: ApiResponse = {
        success: true,
        message: 'Cambios de ruta pendientes obtenidos',
        data: routeChangesResult.rows,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Error obteniendo cambios de ruta pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  }
}