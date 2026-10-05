import mongoose from "mongoose";

const emergencyEventSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
        },

        type: {
            type: String,
            enum: [
                "fall",
                "seizure",
                "critical_vitals",
                "manual",
            ],
            required: true,
        },

        severity: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH"],
            default: "HIGH",
        },

        status: {
            type: String,
            enum: [
                "detected",
                "declared",
                "active",
                "alert_sent",
                "acknowledged",
                "resolved",
                "cancelled",
                "failed",
            ],
            default: "detected",
        },

        message: {
            type: String,
            default: "",
        },

        // ============================================================
        // SMS
        // ============================================================

        smsRequestId: {
            type: String,
            default: "",
        },

        smsStatus: {
            type: String,
            enum: [
                "not_sent",
                "accepted",
                "delivered",
                "failed",
            ],
            default: "not_sent",
        },

        // ============================================================
        // CALL
        // ============================================================

        callStatus: {
            type: String,
            enum: [
                "not_initiated",
                "initiated",
                "completed",
                "failed",
            ],
            default: "not_initiated",
        },

        // ============================================================
        // REFERENCES
        // ============================================================

        band: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Band",
            default: null,
        },

        session: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MonitoringSession",
            default: null,
        },

        // ============================================================
        // VITALS AT TIME OF EMERGENCY
        // ============================================================

        spo2: {
            type: Number,
            default: null,
        },

        heartRate: {
            type: Number,
            default: null,
        },

        hrvSDNN: {
            type: Number,
            default: null,
        },

        temperature: {
            type: Number,
            default: null,
        },

        // ============================================================
        // FALL / MOTION INFORMATION
        // ============================================================

        accelMagnitude: {
            type: Number,
            default: null,
        },

        gyroMagnitude: {
            type: Number,
            default: null,
        },

        tilt: {
            type: Number,
            default: null,
        },

        fallEventConfidence: {
            type: Number,
            default: null,
        },

        eventConfidence: {
            type: Number,
            default: null,
        },

        // ============================================================
        // LOCATION
        // ============================================================

        latitude: {
            type: Number,
            default: null,
        },

        longitude: {
            type: Number,
            default: null,
        },

        // ============================================================
        // TIMESTAMPS
        // ============================================================

        detectedAt: {
            type: Date,
            default: Date.now,
        },

        declaredAt: {
            type: Date,
            default: null,
        },

        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model(
    "EmergencyEvent",
    emergencyEventSchema
);