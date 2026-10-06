import express, { json } from "express";
import pool from "./db.js";
import cors from "cors";
import helmet from "helmet";
import { config } from "dotenv";

import notificationsRoutes from "./routes/notifications.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import dependenciesRoutes from "./routes/dependencies.routes.js";
import authRoutes from "./routes/auth.routes.js";
import risksRoutes from "./routes/risks.routes.js";
import issuesRoutes from "./routes/issues.routes.js";
import actionsRoutes from "./routes/actions.routes.js";
import appreciationsRoutes from "./routes/appreciations.routes.js";
import escalationsRoutes from "./routes/escalations.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import projectRoutes from "./routes/projects.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import userRoutes from "./routes/users.routes.js";
import layoutRoutes from "./routes/layout.routes.js";
import utilsRoutes from "./routes/utils.routes.js";
import managersRoutes from "./routes/managers.routes.js";
import searchRoutes from "./routes/search.routes.js";
import moduleHistoryRoutes from "./routes/moduleHistory.routes.js";
import appNotificationsRoutes from "./routes/appNotifications.routes.js";
import { startReminderScheduler } from "./scheduler/reminder_scheduler.js";

config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Configurations (Helmet)
// Security Configurations (Helmet)
app.disable('x-powered-by'); // Explicitly disable X-Powered-By header

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
                imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "https://RIDE.arche.global", "https://ride.arche.global"],
                connectSrc: ["'self'", "http://localhost:5000", "https://RIDE.arche.global", "https://ride.arche.global"],
                mediaSrc: ["'self'", "http://localhost:5000", "https://RIDE.arche.global", "https://ride.arche.global"],
                frameAncestors: ["'self'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                upgradeInsecureRequests: [],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        strictTransportSecurity: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        },
        xContentTypeOptions: true,
        xFrameOptions: { action: "deny" },
        xPoweredBy: false,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
);

// Global Cache Control to prevent data leakage in browser cache
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
    next();
});

app.use(cors({
    origin: ["https://ride.arche.global", "http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(json());
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  next();
}, express.static("uploads"));




app.get("/api/health", (req, res) => res.json({ success: true, message: "Backend is running" }));


app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

app.use("/feed", feedRoutes);




app.use(authMiddleware);

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/escalations", escalationsRoutes);
app.use("/api/issues", issuesRoutes);
app.use("/api/risks", risksRoutes);
app.use("/api/actions", actionsRoutes);
app.use("/api/dependencies", dependenciesRoutes);
app.use("/api/appreciations", appreciationsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/users", userRoutes);
app.use("/api/layout", layoutRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api/managers", managersRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/module-history", moduleHistoryRoutes);
app.use("/api/app-notifications", appNotificationsRoutes);


app.use("/api/*", (req, res) => {
    res.status(404).json({ success: false, message: "API Route Not Found" });
});


app.use((err, req, res, next) => {
    console.error("Global Error:", err);
    res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

const server = app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT} `);
    try {
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(10),
            ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS risk_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                risk_id VARCHAR(100) NOT NULL,
                updated_by VARCHAR(255),
                old_status VARCHAR(100),
                new_status VARCHAR(100),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_audit_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                module VARCHAR(50) NOT NULL,
                record_id VARCHAR(100) NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                recipient VARCHAR(255) NOT NULL,
                sender VARCHAR(255) NOT NULL,
                subject VARCHAR(500) NOT NULL,
                status VARCHAR(50) NOT NULL,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            ALTER TABLE appreciations
            ADD COLUMN IF NOT EXISTS appreciation_scope VARCHAR(50) DEFAULT 'Internal Appreciation'
        `);
        await pool.query(`
            ALTER TABLE actions
            ADD COLUMN IF NOT EXISTS manual_project_id VARCHAR(255)
        `);
        await pool.query(`
            ALTER TABLE email_audit_log
            ADD COLUMN IF NOT EXISTS internet_message_id VARCHAR(500)
        `);
        console.log("Auto-Migration: Ensure OTP columns, risk_history, email_audit_log (+ internet_message_id), appreciation_scope, and actions.manual_project_id exist.");
        
        startReminderScheduler();
    } catch (err) {
        console.error("Auto-Migration failed:", err);
    }
});

server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the other backend process, then restart.`);
        process.exit(1);
    }
    console.error("Server failed to start:", err);
    process.exit(1);
});
