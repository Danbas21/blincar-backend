import { pool } from './database';

export const createFCMTables = async () => {
  try {
    console.log('🔄 Creando tablas para Firebase Cloud Messaging...');
    console.log('⏳ Esperando conexión a la base de datos (puede tardar si está en sleep)...');

    // Tabla de tokens FCM de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token VARCHAR(500) NOT NULL UNIQUE,
        device_type VARCHAR(20) CHECK (device_type IN ('android', 'ios', 'web')),
        device_name VARCHAR(200),
        device_id VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices para user_fcm_tokens
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id
      ON user_fcm_tokens(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_active
      ON user_fcm_tokens(user_id) WHERE is_active = true
    `);

    // Tabla de logs de notificaciones (para debugging y analytics)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token VARCHAR(500),
        send_status VARCHAR(20) CHECK (send_status IN ('pending', 'sent', 'failed', 'invalid_token')) DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices para notification_logs
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_status
      ON notification_logs(send_status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_user
      ON notification_logs(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_notification
      ON notification_logs(notification_id)
    `);

    console.log('✅ Tablas FCM creadas exitosamente');
  } catch (error) {
    console.error('❌ Error creando tablas FCM:', error);
    throw error;
  }
};
