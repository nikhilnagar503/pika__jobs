import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "@/config/env";
import { adminRouter } from "@/routes/admin";
import { healthRouter } from "@/routes/health";
import { ingestionRouter } from "@/routes/ingestion";
import { jobsRouter } from "@/routes/jobs";
import { meRouter } from "@/routes/me";

const app = express();

app.use(
  helmet({
    // API is called from the Vercel frontend on another origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/", (_req, res) => {
  res.json({
    name: "Pikajobs API",
    docs: "/health",
    version: "0.1.0",
  });
});

app.use("/health", healthRouter);
app.use("/api/v1/jobs", jobsRouter);
app.use("/api/v1/me", meRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/ingestion", ingestionRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ code: "internal_error", message: "Something went wrong." });
});

app.listen(env.port, () => {
  console.log(`Pikajobs API listening on http://localhost:${env.port}`);
});
