import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";

import routes from "./routes/routes";
import { swaggerSpec } from "./core/config/swagger.config";
import { requestLogger } from "./core/logger/request-logger.middleware";
import { errorHandler } from "./core/errors";
import { env } from "./core/config/env";
import { logger } from "./core/logger/logger";

dotenv.config();

// Declarations
const app = express();

// Middlewares
app.use(requestLogger);
app.use(express.json());

// Routes
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", routes);
app.use(errorHandler);

// Server start
app.listen(env.PORT, () => {
  logger.info(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
});
