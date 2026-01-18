import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Importar rutas
import authRoutes from './routes/authRoutes';
import panicRoutes from './routes/panicRoutes';
import recordingRoutes from './routes/recordingRoutes';
import paymentRoutes from './routes/paymentRoutes';
import stripeRoutes from './routes/stripeRoutes';
import reservationRoutes from './routes/reservationRoutes';
import notificationRoutes from './routes/notificationRoutes';
import routeRoutes from './routes/routeRoutes';
import trackingRoutes from './routes/trackingRoutes';




// Importar configuraciones
import { connectDB } from './config/database';
import redisHelper from './config/redis';

// Cargar variables de entorno
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      process.env.ADMIN_URL || "http://localhost:8000"
    ],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    process.env.ADMIN_URL || "http://localhost:8000"
  ],
  credentials: true
}));

// Middlewares generales
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Registrar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/panic', panicRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/tracking', trackingRoutes);



// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor Blincar funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Ruta 404 para APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    timestamp: new Date().toISOString()
  });
});

// Socket.io para tiempo real
io.on('connection', (socket) => {
  console.log(`👤 Usuario conectado: ${socket.id}`);

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log(`👋 Usuario desconectado: ${socket.id}`);
  });

  // Evento de prueba
  socket.on('test_message', (data) => {
    console.log('📨 Mensaje recibido:', data);
    socket.emit('test_response', {
      message: 'Mensaje recibido correctamente',
      timestamp: new Date().toISOString()
    });
  });
});

// Función de inicio del servidor
const startServer = async () => {
  try {
    // Conectar base de datos
    await connectDB();
    
    // Conectar Redis (opcional)
    await redisHelper.connect();
    
    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`
🚀 Servidor Blincar iniciado correctamente
📡 Puerto: ${PORT}
🌍 Entorno: ${process.env.NODE_ENV}
📊 Health Check: http://localhost:${PORT}/health
🔗 Socket.io habilitado
      `);
    });
    
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

// Manejar cierre del servidor
process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando servidor...');
  await redisHelper.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Cerrando servidor...');
  await redisHelper.disconnect();
  process.exit(0);
});

// Iniciar servidor
startServer();

export { io };