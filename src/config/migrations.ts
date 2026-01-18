import { pool } from "./database";

export const createTables = async () => {
  try {
    console.log('🔄 Creando tablas de la base de datos...');

    // Tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(15) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('passenger', 'driver', 'admin')) DEFAULT 'passenger',
        status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
        profile_image TEXT,
        phone_verified BOOLEAN DEFAULT FALSE,
        email_verified BOOLEAN DEFAULT FALSE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de vehículos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
        make VARCHAR(50) NOT NULL,
        model VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        color VARCHAR(30) NOT NULL,
        license_plate VARCHAR(20) UNIQUE NOT NULL,
        capacity INTEGER DEFAULT 4,
        type VARCHAR(20) CHECK (type IN ('sedan', 'suv', 'van', 'motorcycle')) DEFAULT 'sedan',
        is_verified BOOLEAN DEFAULT FALSE,
        documents JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de conductores (información adicional)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        license_number VARCHAR(50) UNIQUE NOT NULL,
        license_expiry DATE NOT NULL,
        vehicle_id UUID REFERENCES vehicles(id),
        status VARCHAR(20) CHECK (status IN ('available', 'busy', 'offline')) DEFAULT 'offline',
        current_location JSONB,
        rating DECIMAL(3,2) DEFAULT 5.00,
        total_trips INTEGER DEFAULT 0,
        total_earnings DECIMAL(10,2) DEFAULT 0.00,
        is_verified BOOLEAN DEFAULT FALSE,
        verification_documents JSONB,
        background_check_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de viajes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) CHECK (status IN ('requested', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested',
        origin_address TEXT NOT NULL,
        destination_address TEXT NOT NULL,
        origin_coordinates JSONB NOT NULL,
        destination_coordinates JSONB NOT NULL,
        estimated_distance DECIMAL(8,2),
        estimated_duration INTEGER,
        estimated_price DECIMAL(8,2),
        actual_price DECIMAL(8,2),
        actual_distance DECIMAL(8,2),
        actual_duration INTEGER,
        route_data JSONB,
        trip_data JSONB,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancel_reason TEXT,
        cancelled_by UUID REFERENCES users(id),
        rating_by_passenger INTEGER CHECK (rating_by_passenger >= 1 AND rating_by_passenger <= 5),
        rating_by_driver INTEGER CHECK (rating_by_driver >= 1 AND rating_by_driver <= 5),
        comment_by_passenger TEXT,
        comment_by_driver TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de pagos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
        driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'MXN',
        payment_method VARCHAR(50) NOT NULL,
        stripe_payment_intent_id VARCHAR(255),
        status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
        platform_fee DECIMAL(10,2) DEFAULT 0.00,
        driver_earnings DECIMAL(10,2) DEFAULT 0.00,
        payment_data JSONB,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de mensajes (chat)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        message_type VARCHAR(20) CHECK (message_type IN ('text', 'image', 'location', 'system')) DEFAULT 'text',
        is_read BOOLEAN DEFAULT FALSE,
        attachment_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de ubicaciones en tiempo real
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_updates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        coordinates JSONB NOT NULL,
        speed DECIMAL(5,2),
        heading DECIMAL(5,2),
        accuracy DECIMAL(5,2),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices para optimizar consultas
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_trips_passenger ON trips(passenger_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_trip ON messages(trip_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_location_trip ON location_updates(trip_id)`);

    console.log('✅ Todas las tablas creadas exitosamente');

  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    throw error;
  }
};

export const dropTables = async () => {
  try {
    console.log('🗑️ Eliminando todas las tablas...');
    
    await pool.query('DROP TABLE IF EXISTS location_updates CASCADE');
    await pool.query('DROP TABLE IF EXISTS messages CASCADE');
    await pool.query('DROP TABLE IF EXISTS payments CASCADE');
    await pool.query('DROP TABLE IF EXISTS trips CASCADE');
    await pool.query('DROP TABLE IF EXISTS drivers CASCADE');
    await pool.query('DROP TABLE IF EXISTS vehicles CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('✅ Todas las tablas eliminadas');
  } catch (error) {
    console.error('❌ Error eliminando tablas:', error);
    throw error;
  }
};