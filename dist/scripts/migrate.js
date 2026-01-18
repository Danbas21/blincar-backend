"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const migrations_1 = require("../config/migrations");
const new_migrations_1 = require("../config/new-migrations");
const database_1 = require("../config/database");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const main = async () => {
    const command = process.argv[2];
    try {
        switch (command) {
            case 'up':
                await (0, migrations_1.createTables)();
                await (0, new_migrations_1.createNewTables)();
                break;
            case 'new':
                await (0, new_migrations_1.createNewTables)();
                break;
            case 'down':
                await (0, migrations_1.dropTables)();
                break;
            case 'reset':
                await (0, migrations_1.dropTables)();
                await (0, migrations_1.createTables)();
                await (0, new_migrations_1.createNewTables)();
                break;
            default:
                console.log(`
🛠️  Comandos de migración disponibles:

npm run migrate up     - Crear todas las tablas (originales + nuevas)
npm run migrate new    - Crear solo las nuevas tablas
npm run migrate down   - Eliminar todas las tablas  
npm run migrate reset  - Recrear todas las tablas

Ejemplo: npm run migrate new
        `);
        }
    }
    catch (error) {
        console.error('Error en migración:', error);
        process.exit(1);
    }
    finally {
        await database_1.pool.end();
        process.exit(0);
    }
};
main();
