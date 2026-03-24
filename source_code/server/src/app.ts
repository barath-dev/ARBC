import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/environment";
import { errorHandler } from "./middlewares/errorHandler";
import apiRouter from "./routes";
import { logger } from "./utils/logger";
import { initQueue, stopQueue } from "./services/job-queue.service";

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
  } else {
    next();
  }
});
app.use(express.json());

// API Routes
app.use("/api", apiRouter);

// Error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, async () => {
  logger.info(`ARBC server running on port ${env.PORT}`);
  await initQueue();
});

process.on("SIGTERM", async () => {
  await stopQueue();
  process.exit(0);
});

export default app;
