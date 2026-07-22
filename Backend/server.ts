import app from "./src/app.js";
import prisma from "./src/config/prisma.js";
import { startSessionScheduler } from "./src/services/smartapi/index.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(` 🪬🪬🪬Server running on http://localhost:${PORT}`);
    console.log(`✌✌Swagger documentation on http://localhost:${PORT}/api-docs`);

    try {
        await prisma.$connect();
        console.log("[Database] Connected successfully via Prisma.");
    } catch (error) {
        console.error("[Database] Connection failed:", error);
    }

    try {
        // Start periodic session refresh loop for SmartAPI
        startSessionScheduler();
    } catch (error) {
        console.error("[SmartAPI] Failed to start session scheduler:", error);
    }
});
