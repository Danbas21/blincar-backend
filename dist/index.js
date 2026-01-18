"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const panicRoutes_1 = __importDefault(require("./routes/panicRoutes"));
const recordingRoutes_1 = __importDefault(require("./routes/recordingRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const reservationRoutes_1 = __importDefault(require("./routes/reservationRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const routeRoutes_1 = __importDefault(require("./routes/routeRoutes"));
const trackingRoutes_1 = __importDefault(require("./routes/trackingRoutes"));
// Importar configuraciones
const database_1 = require("./config/database");
const redis_1 = __importDefault(require("./config/redis"));
// Cargar variables de entorno
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || "http://localhost:3000",
            process.env.ADMIN_URL || "http://localhost:8000"
        ],
        methods: ["GET", "POST"]
    }
});
exports.io = io;
const PORT = process.env.PORT || 3000;
// Middlewares de seguridad
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:3000",
        process.env.ADMIN_URL || "http://localhost:8000"
    ],
    credentials: true
}));
// Middlewares generales
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/panic', panicRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/panic', panicRoutes_1.default);
app.use('/api/recordings', recordingRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/panic', panicRoutes_1.default);
app.use('/api/recordings', recordingRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.use('/api/reservations', reservationRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/routes', routeRoutes_1.default);
app.use('/api/tracking', trackingRoutes_1.default);
// Ruta de prueba
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Servidor Blincar funcionando correctamente',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});
app.use('/api/auth', authRoutes_1.default);
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
        await (0, database_1.connectDB)();
        // Conectar Redis
        await redis_1.default.connect();
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
    }
    catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
};
// Manejar cierre del servidor
process.on('SIGTERM', async () => {
    console.log('🛑 Cerrando servidor...');
    await redis_1.default.disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando servidor...');
    await redis_1.default.disconnect();
    process.exit(0);
});
// Iniciar servidor
startServer();
