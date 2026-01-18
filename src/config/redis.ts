import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis es opcional - si no esta disponible, el servidor funciona sin cache
let redisClient: RedisClientType | null = null;
let redisEnabled = process.env.REDIS_ENABLED !== 'false';

const createRedisClient = () => {
  if (!redisEnabled) {
    console.log('⚠️  Redis deshabilitado - funcionando sin cache');
    return null;
  }

  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.log('⚠️  Redis no disponible - funcionando sin cache');
          redisEnabled = false;
          return false; // Stop reconnecting
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  client.on('connect', () => {
    console.log('✅ Redis conectado correctamente');
  });

  client.on('error', () => {
    // Silenciar errores repetidos
  });

  return client as RedisClientType;
};

redisClient = createRedisClient();

// Helper para operaciones seguras de Redis
export const redisHelper = {
  async get(key: string): Promise<string | null> {
    if (!redisClient || !redisEnabled) return null;
    try {
      return await redisClient.get(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!redisClient || !redisEnabled) return;
    try {
      if (ttl) {
        await redisClient.setEx(key, ttl, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch {
      // Ignorar errores de Redis
    }
  },
  async del(key: string): Promise<void> {
    if (!redisClient || !redisEnabled) return;
    try {
      await redisClient.del(key);
    } catch {
      // Ignorar errores de Redis
    }
  },
  async connect(): Promise<void> {
    if (!redisClient || !redisEnabled) return;
    try {
      await redisClient.connect();
    } catch {
      console.log('⚠️  Redis no disponible - funcionando sin cache');
      redisEnabled = false;
    }
  },
  async disconnect(): Promise<void> {
    if (!redisClient || !redisEnabled) return;
    try {
      await redisClient.disconnect();
    } catch {
      // Ignorar errores
    }
  }
};

export default redisHelper;