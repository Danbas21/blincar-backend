import { pool } from './database';

export const createStripeTables = async () => {
  try {
    console.log('🔄 Creando tablas y columnas para Stripe...');

    // Agregar columna firebase_uid a la tabla users (para autenticacion Firebase)
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE
    `);
    console.log('✅ Columna firebase_uid agregada a users');

    // Agregar columna stripe_customer_id a la tabla users
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE
    `);
    console.log('✅ Columna stripe_customer_id agregada a users');

    // Crear indice para busquedas rapidas
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
      ON users(stripe_customer_id)
      WHERE stripe_customer_id IS NOT NULL
    `);
    console.log('✅ Indice de stripe_customer_id creado');

    // Actualizar tabla payments para asegurar que tiene todas las columnas necesarias
    await pool.query(`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS stripe_refund_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_method_brand VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_method_last4 VARCHAR(4),
      ADD COLUMN IF NOT EXISTS failure_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS failure_message TEXT
    `);
    console.log('✅ Columnas adicionales agregadas a payments');

    console.log('✅ Todas las migraciones de Stripe completadas');

  } catch (error) {
    console.error('❌ Error en migraciones de Stripe:', error);
    throw error;
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  createStripeTables()
    .then(() => {
      console.log('Migraciones completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}
