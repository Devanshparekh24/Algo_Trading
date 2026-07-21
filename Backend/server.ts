import express from "express";
import prisma from "./src/config/prisma";
import { getUserProfile } from "./src/services/smartapi.js";

const app = express();

app.get("/", async (_, res) => {
    try {
        // Test the connection only
        await prisma.$connect();
        res.json({ message: "Successfully connected to the database!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Database connection failed" });
    }
});

app.get("/profile", async (_, res) => {
    try {
        const profile = await getUserProfile();
        res.json({ success: true, profile });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

app.listen(5000, () => {
    console.log(" 🪬🪬🪬Server running on http://localhost:5000");
});