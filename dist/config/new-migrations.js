"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNewTables = void 0;
const database_1 = require("./database");
const createNewTables = async () => {
    try {
        console.log('🔄 Creando nuevas tablas para funcionalidades avanzadas...');
        // Tabla de contactos de emergencia
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        contact_name VARCHAR(100) NOT NULL,
        contact_phone VARCHAR(15) NOT NULL,
        relationship VARCHAR(50),
        is_primary BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabla de tipos de servicio
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS service_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        base_price DECIMAL(8,2) NOT NULL,
        price_per_km DECIMAL(8,2) DEFAULT 0,
        price_per_minute DECIMAL(8,2) DEFAULT 0,
        price_per_hour DECIMAL(8,2) DEFAULT 0,
        price_per_day DECIMAL(10,2) DEFAULT 0,
        commission_percentage DECIMAL(5,2) DEFAULT 15.00,
        is_active BOOLEAN DEFAULT true,
        requires_special_license BOOLEAN DEFAULT false,
        vehicle_requirements JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabla de alertas de pánico
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS panic_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        alert_type VARCHAR(20) CHECK (alert_type IN ('volume_button', 'app_button')) NOT NULL,
        location_coordinates JSONB NOT NULL,
        is_resolved BOOLEAN DEFAULT false,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMP,
        admin_notes TEXT,
        emergency_contact_notified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabla de grabaciones de viajes
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS trip_recordings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        recording_type VARCHAR(20) CHECK (recording_type IN ('video', 'audio', 'both')) DEFAULT 'both',
        file_path TEXT NOT NULL,
        file_size_mb DECIMAL(10,2),
        duration_seconds INTEGER,
        recording_quality VARCHAR(10) DEFAULT '4K',
        is_streaming BOOLEAN DEFAULT false,
        stream_url TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        storage_status VARCHAR(20) DEFAULT 'uploading'
      )
    `);
        // Tabla de reservas de viajes
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS trip_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
        service_type_id UUID REFERENCES service_types(id),
        scheduled_date DATE NOT NULL,
        scheduled_time TIME,
        duration_type VARCHAR(20) CHECK (duration_type IN ('hours', 'days', 'trip')) NOT NULL,
        duration_value INTEGER, -- horas o días
        origin_address TEXT NOT NULL,
        destination_address TEXT,
        origin_coordinates JSONB NOT NULL,
        destination_coordinates JSONB,
        estimated_price DECIMAL(10,2) NOT NULL,
        special_requirements TEXT,
        status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'assigned', 'completed', 'cancelled')) DEFAULT 'pending',
        assigned_driver_id UUID REFERENCES users(id),
        assigned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabla de ganancias de conductores
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS driver_earnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
        trip_id UUID REFERENCES trips(id),
        earning_type VARCHAR(20) CHECK (earning_type IN ('trip_payment', 'cash_collection', 'commission_deduction', 'withdrawal')) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        commission_percentage DECIMAL(5,2),
        commission_amount DECIMAL(10,2),
        net_amount DECIMAL(10,2),
        payment_method VARCHAR(20) CHECK (payment_method IN ('card', 'cash', 'transfer')),
        payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabla de notificaciones
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        notification_type VARCHAR(30) CHECK (notification_type IN (
          'trip_request', 'trip_accepted', 'trip_started', 'trip_completed',
          'payment_received', 'reservation_reminder', 'route_change_request',
          'panic_alert', 'admin_message', 'system_update'
        )) NOT NULL,
        related_trip_id UUID REFERENCES trips(id),
        is_read BOOLEAN DEFAULT false,
        is_push_sent BOOLEAN DEFAULT false,
        push_sent_at TIMESTAMP,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Tabla de cambios de ruta dinámicos
        await database_1.pool.query(`
      CREATE TABLE IF NOT EXISTS route_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
        original_route JSONB NOT NULL,
        new_route JSONB NOT NULL,
        reason TEXT NOT NULL,
        passenger_approval_status VARCHAR(20) CHECK (passenger_approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        passenger_response_at TIMESTAMP,
        admin_notified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Actualizar tabla trips para nuevos campos
        await database_1.pool.query(`
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES service_types(id);
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS has_recording BOOLEAN DEFAULT false;
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS panic_alerts_count INTEGER DEFAULT 0;
      ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_changes_count INTEGER DEFAULT 0;
    `);
        // Actualizar tabla users para contacto de emergencia durante registro
        await database_1.pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(15);
    `);
        // Insertar tipos de servicio por defecto
        await database_1.pool.query(`
      INSERT INTO service_types (name, description, base_price, price_per_km, commission_percentage) VALUES
      ('Viaje Ahora', 'Servicio básico de transporte inmediato', 1.00, 0.50, 15.00),
      ('Viaje por Hora', 'Servicio de transporte por horas', 2.00, 0.75, 15.00),
      ('Viaje por Días', 'Servicio de transporte por días completos', 3.00, 1.00, 15.00),
      ('Auto con Chofer', 'Servicio premium con chofer profesional', 4.00, 1.25, 15.00),
      ('Auto Blindado', 'Servicio de seguridad con vehículo blindado', 5.00, 2.00, 15.00),
      ('Auto con Escolta Armado', 'Servicio de alta seguridad con escolta armada', 6.00, 2.50, 15.00),
      ('Auto con Escolta Desarmado', 'Servicio de seguridad con escolta desarmada', 7.00, 2.25, 15.00)
      ON CONFLICT DO NOTHING
    `);
        // Índices para optimizar consultas
        // Índices para optimizar consultas (después de crear todas las tablas)
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_panic_alerts_trip ON panic_alerts(trip_id)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_panic_alerts_unresolved ON panic_alerts(user_id, is_resolved) WHERE is_resolved = false`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_trip_recordings_trip ON trip_recordings(trip_id)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_reservations_date ON trip_reservations(scheduled_date)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_reservations_status ON trip_reservations(status)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_earnings_driver ON driver_earnings(driver_id)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = false`);
        await database_1.pool.query(`CREATE INDEX IF NOT EXISTS idx_route_changes_trip ON route_changes(trip_id)`);
        console.log('✅ Todas las nuevas tablas creadas exitosamente');
    }
    catch (error) {
        console.error('❌ Error creando nuevas tablas:', error);
        throw error;
    }
};
exports.createNewTables = createNewTables;
