import express from "express";
import prisma from "./src/config/prisma";

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

app.listen(5000, () => {
    console.log(" 🪬🪬🪬Server running on http://localhost:5000");
});