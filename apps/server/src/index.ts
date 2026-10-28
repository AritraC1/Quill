import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import routes from "./routes/routes";
import { swaggerSpec } from "./core/config/swagger.config";
import { requestLogger } from "./core/logger/request-logger.middleware";
import { errorHandler } from "./core/errors";
import { env } from "./core/config/env";
import { logger } from "./core/logger/logger";

// Declarations
const app = express();

// Middlewares
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", routes);
app.use(errorHandler);

// Server start
app.listen(env.PORT, () => {
  logger.info(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
});
