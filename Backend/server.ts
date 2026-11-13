import http from "http";
import app from "./src/app.js";
import prisma from "./src/config/prisma.js";
import { startSessionScheduler, startInstrumentScheduler, getValidSession } from "./src/services/smartapi/index.js";
import { getTopFnoMovers } from "./src/services/smartapi/fnoMovers.service.js";
import { initSocketServer } from "./src/services/websocket/socketService.js";
import { seedMarketHolidays, seedSundayMarketOpen } from "./src/services/marketHoliday.service.js";
import { loadPersistedOpenPositions } from "./src/services/ai/aiTrading.service.js";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Handle server errors (e.g. EADDRINUSE) gracefully
server.on("error", (error: any) => {
    if (error.code === "EADDRINUSE") {
        console.error(`\n❌ [Server Error] Port ${PORT} is already in use by another process.`);
        console.error(`💡 Tip: Run 'Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force' to free the port.\n`);
        process.exit(1);
    }
    console.error("❌ [Server Error]:", error);
    process.exit(1);
});

// Initialize Socket.IO real-time WebSocket server
initSocketServer(server);

// Graceful process shutdown
const gracefulShutdown = () => {
    console.log("\n[Server] Closing HTTP & WebSocket connections...");
    server.close(() => {
        prisma.$disconnect().finally(() => {
            console.log("[Server] Exited cleanly.");
            process.exit(0);
        });
    });
};
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

server.listen(PORT, async () => {
    console.log(` 🪬 🪬 🪬 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket & Webhook real-time stream ready on ws://localhost:${PORT}`);
    console.log(`✌ ✌ Swagger documentation on http://localhost:${PORT}/api-docs`);

    try {
        await prisma.$connect();
        console.log("[Database] Connected successfully via Prisma.");
        // Rehydrate in-memory positions from PostgreSQL AiTradeLog
        await loadPersistedOpenPositions();
    } catch (error) {
        console.error("[Database] Connection failed:", error);
    }

    try {
        // Authenticate & initialize session before starting schedulers & warmups
        console.log("[SmartAPI] Pre-warming session on boot...");
        await getValidSession();
        console.log("[SmartAPI] Session active.");
    } catch (error: any) {
        console.warn("[SmartAPI] Boot session notice:", error?.message || error);
    }

    try {
        // Start periodic session refresh loop for SmartAPI
        startSessionScheduler();
    } catch (error) {
        console.error("[SmartAPI] Failed to start session scheduler:", error);
    }

    try {
        // Start instrument scheduler check and daily sync
        await startInstrumentScheduler();
    } catch (error) {
        console.error("[SmartAPI] Failed to start instrument scheduler:", error);
    }

    try {
        // Initialize & seed official NSE/BSE market holidays in PostgreSQL
        await seedMarketHolidays();
        // Seed share-market holidays that fall on Sat/Sun into SundayMarkeopen table
        await seedSundayMarketOpen();
    } catch (error) {
        console.error("[MarketHoliday] Failed to seed market holidays:", error);
    }

    try {
        // Pre-warm F&O Movers in background for instant live streaming
        getTopFnoMovers().catch((e) => console.warn("[FnoMovers] Warmup notice:", e?.message || e));
    } catch {
        // Continue gracefully
    }
});
