import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import healthCardRoutes from "./routes/healthCardRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import medicalTimelineRoutes from "./routes/medicalTimelineRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import smsTestRoutes from "./routes/smsTestRoutes.js";
import emergencyRoutes from "./routes/emergencyRoutes.js";

import connectDB from "./config/db.js";

// Routes
import patientRoutes from "./routes/patientRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import vitalsRoutes from "./routes/vitalsRoutes.js";
import bulkRoutes from "./routes/bulkRoutes.js";
import translationRoutes from "./routes/translationRoutes.js";
import visitRoutes from "./routes/visitRoutes.js";
import accessGrantRoutes from "./routes/accessGrantRoutes.js";
import externalRecordRoutes from "./routes/externalRecordRoutes.js";


dotenv.config();

connectDB();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.set("io", io);

io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    socket.on("joinPatient", (patientId) => {
        if (patientId) {
            socket.join(`patient_${patientId}`);
            console.log(`📡 Patient room joined: ${patientId}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("🔌 Socket disconnected:", socket.id);
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "🚀 MedJarvis Backend Running",
    });
});

// API Routes
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/health-card", healthCardRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/timeline", medicalTimelineRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/sms-test", smsTestRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/translation", translationRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/access-grants", accessGrantRoutes);
app.use("/api/external-records", externalRecordRoutes);

app.get("/api/vitals-test", (req, res) => {
    res.json({
        success: true,
        message: "SERVER.JS VITALS TEST WORKING"
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
    });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ LAN access: http://10.210.70.183:${PORT}`);
});