import AgentAPI from "apminsight";
AgentAPI.config();

import express from "express";
import subjectsRouter from "./routes/subjects.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import departmentsRouter from "./routes/departments.js";
import classJoinRequestRouter from "./routes/class-join-requests.js";
import enrollmentsRouter from "./routes/enrollments.js";
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./lib/auth.js";

const app = express();
const port = 8000;

const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL is not set in .env file");
}

app.use(
  cors({
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

const authHandler = toNodeHandler(auth);
app.all("/api/auth/{*path}", (req, res) => authHandler(req, res));

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session) {
      req.user = {
        role: session.user.role as any,
      };
    }
    next();
  } catch (e) {
    console.error("Session middleware error:", e);
    next();
  }
});

app.use(securityMiddleware);

app.use("/api/subjects", subjectsRouter);
app.use("/api/users", usersRouter);
app.use("/api/classes", classesRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/enrollments", enrollmentsRouter);
app.use("/api/class-join-requests", classJoinRequestRouter);

app.get("/", (req, res) => {
  res.send("Welcome to the Classroom Backend!");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

app.get("/api/debug/session", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  res.json({
    userId: session?.user?.id,
    role: (session?.user as any)?.role,
  });
});
