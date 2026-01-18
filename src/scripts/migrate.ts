import { createTables, dropTables } from '../config/migrations';
import { createNewTables } from '../config/new-migrations';
import { createStripeTables } from '../config/stripe-migrations';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
        await createTables();
        await createNewTables();
        await createStripeTables();
        break;
      case 'new':
        await createNewTables();
        break;
      case 'stripe':
        await createStripeTables();
        break;
      case 'down':
        await dropTables();
        break;
      case 'reset':
        await dropTables();
        await createTables();
        await createNewTables();
        await createStripeTables();
        break;
      default:
        console.log(`
🛠️  Comandos de migración disponibles:

npm run migrate up     - Crear todas las tablas (originales + nuevas + stripe)
npm run migrate new    - Crear solo las nuevas tablas
npm run migrate stripe - Crear solo las tablas de Stripe
npm run migrate down   - Eliminar todas las tablas
npm run migrate reset  - Recrear todas las tablas

Ejemplo: npm run migrate stripe
        `);
    }
  } catch (error) {
    console.error('Error en migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

main();