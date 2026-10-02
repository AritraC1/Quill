import "./jobs/email.job"; // side-effect: constructs the Worker
import { logger } from "./core/logger/logger";

logger.info("BullMQ workers started");