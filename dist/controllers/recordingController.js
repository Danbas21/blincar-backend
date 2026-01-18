"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingController = void 0;
const database_1 = require("../config/database");
class RecordingController {
    // Iniciar grabación de viaje
    static async startRecording(req, res) {
        const { tripId, cameraApiUrl } = req.body;
        try {
            // Verificar que el viaje existe y está en progreso
            const tripResult = await database_1.pool.query(`
        SELECT status FROM trips WHERE id = $1
      `, [tripId]);
            if (tripResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Viaje no encontrado',
                    timestamp: new Date().toISOString()
                });
            }
            // TODO: Integrar con API de cámara externa
            // Por ahora simulamos la URL de streaming
            const streamUrl = `https://stream.blincar.com/live/${tripId}`;
            const filePath = `s3://blincar-recordings/trips/${tripId}/recording.mp4`;
            // Insertar registro de grabación
            const recordingResult = await database_1.pool.query(`
        INSERT INTO trip_recordings 
        (trip_id, recording_type, file_path, is_streaming, stream_url)
        VALUES ($1, 'both', $2, true, $3)
        RETURNING id
      `, [tripId, filePath, streamUrl]);
            // Marcar trip como con grabación
            await database_1.pool.query(`
        UPDATE trips SET has_recording = true WHERE id = $1
      `, [tripId]);
            const response = {
                success: true,
                message: 'Grabación iniciada exitosamente',
                data: {
                    recordingId: recordingResult.rows[0].id,
                    streamUrl,
                    filePath
                },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error iniciando grabación:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Finalizar grabación de viaje
    static async stopRecording(req, res) {
        const { tripId } = req.body;
        try {
            // Actualizar grabación como finalizada
            const recordingResult = await database_1.pool.query(`
        UPDATE trip_recordings 
        SET ended_at = CURRENT_TIMESTAMP, is_streaming = false, storage_status = 'completed'
        WHERE trip_id = $1 AND ended_at IS NULL
        RETURNING id, file_path, started_at
      `, [tripId]);
            if (recordingResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No hay grabación activa para este viaje',
                    timestamp: new Date().toISOString()
                });
            }
            const recording = recordingResult.rows[0];
            // Calcular duración aproximada
            const duration = Math.floor((Date.now() - new Date(recording.started_at).getTime()) / 1000);
            await database_1.pool.query(`
        UPDATE trip_recordings 
        SET duration_seconds = $1
        WHERE id = $2
      `, [duration, recording.id]);
            const response = {
                success: true,
                message: 'Grabación finalizada y almacenada',
                data: {
                    recordingId: recording.id,
                    duration: `${Math.floor(duration / 60)}:${duration % 60} min`,
                    filePath: recording.file_path
                },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error finalizando grabación:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
    // Obtener grabaciones de un viaje (para admin)
    static async getTripRecordings(req, res) {
        const { tripId } = req.params;
        try {
            const recordingsResult = await database_1.pool.query(`
        SELECT * FROM trip_recordings 
        WHERE trip_id = $1
        ORDER BY started_at DESC
      `, [tripId]);
            const response = {
                success: true,
                message: 'Grabaciones del viaje obtenidas',
                data: recordingsResult.rows,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error obteniendo grabaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
}
exports.RecordingController = RecordingController;
