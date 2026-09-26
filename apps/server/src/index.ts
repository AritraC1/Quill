import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./core/swagger/swagger.config";
import routes from "./routes/routes";

dotenv.config();

// Declarations
const PORT = process.env.PORT_NUMBER || 3000;
const app = express();

// Middlewares

// Routes
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", routes);

// Server start
app.listen(PORT, () => {
  console.log(`The server is running on the port: ${PORT}`);
});
