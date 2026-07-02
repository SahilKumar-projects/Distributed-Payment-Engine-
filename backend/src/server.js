const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
require('dotenv').config();
const connectMongo = require('./config/mongo');

const PORT = process.env.PORT || 3000;

// 1. Create a raw HTTP server to wrap Express
const server = http.createServer(app);

// 2. Attach Socket.io to the server with CORS enabled for your React app
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Your React Vite port
        methods: ["GET", "POST"]
    }
});

// 3. Make 'io' globally accessible to our controllers
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`⚡ Frontend connected to WebSocket: ${socket.id}`);
});

connectMongo().then(() => {
    // CRITICAL FIX: Make sure you call server.listen, NOT app.listen!
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT} with WebSockets enabled`);
    });
});