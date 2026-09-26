import express from "express";
import dotenv from "dotenv";

dotenv.config();

// Declarations
const PORT = process.env.PORT_NUMBER || 3000;
const app = express();

// Middlewares

// Routes

// Server start
app.listen(PORT, () => {
    console.log(`The server is running on the port: ${PORT}`)
});
