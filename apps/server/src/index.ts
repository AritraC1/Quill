import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import routes from "./routes/routes";
import { swaggerSpec } from "./core/swagger/swagger.config";
import { requestLogger } from "./core/logger/request-logger.middleware";
import { errorHandler } from "./core/errors";

dotenv.config();

// Declarations
const PORT = process.env.PORT_NUMBER || 3000;
const app = express();

// Middlewares
app.use(requestLogger);
app.use(express.json());

// Routes
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", routes);
app.use(errorHandler);

// Server start
app.listen(PORT, () => {
  console.log(`The server is running on the port: ${PORT}`);
});
