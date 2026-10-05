import mongoose from "mongoose";

const vitalReadingSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
        },

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
        // PHYSIOLOGICAL VITALS
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
        // MEASUREMENT CONFIDENCE
        //
        // These represent measurement/signal quality confidence.
        // They are NOT clinical accuracy percentages.
        // ============================================================

        measurementConfidence: {
            type: Number,
            default: null,
        },

        spo2Confidence: {
            type: Number,
            default: null,
        },

        heartRateConfidence: {
            type: Number,
            default: null,
        },

        hrvConfidence: {
            type: Number,
            default: null,
        },

        // ============================================================
        // MOTION / SENSOR DATA
        // ============================================================

        tilt: {
            type: Number,
            default: null,
        },

        signalQuality: {
            type: Number,
            default: null,
        },

        accelMagnitude: {
            type: Number,
            default: null,
        },

        gyroMagnitude: {
            type: Number,
            default: null,
        },

        accelX: Number,
        accelY: Number,
        accelZ: Number,

        gyroX: Number,
        gyroY: Number,
        gyroZ: Number,

        // ============================================================
        // ACQUISITION / VALIDATION INFORMATION
        // ============================================================

        measurementDuration: {
            type: Number,
            default: 60,
        },

        maxSamples: Number,

        spo2WindowSamples: Number,

        mpuSamples: Number,

        validatedBeats: Number,

        validatedRRIntervals: Number,

        validHRWindows: Number,

        validSpO2Windows: Number,

        // ============================================================
        // RAW OPTICAL VALUES
        // ============================================================

        ir: Number,

        red: Number,

        // ============================================================
        // CONNECTION / MODE
        // ============================================================

        wifiConnected: {
            type: Boolean,
            default: false,
        },

        mode: {
            type: String,
            enum: ["spot", "continuous"],
            default: "spot",
        },

        // ============================================================
        // FALL FLAG
        // ============================================================

        fallDetected: {
            type: Boolean,
            default: false,
        },

        // ============================================================
        // SOURCE
        // ============================================================

        // ============================================================
        // PROVENANCE & RECORDING CONTEXT METADATA
        // ============================================================

        recordedByProfile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            default: null,
        },

        recordedByRole: {
            type: String,
            default: "",
        },

        hospital: {
            type: String,
            default: "",
        },

        measurementSource: {
            type: String,
            default: "ESP32_BAND",
        },

        measurementContext: {
            type: String,
            enum: [
                "SELF_MONITORING",
                "CLINICAL_MONITORING",
                "FIELD_VISIT",
                "EMERGENCY",
                "",
            ],
            default: "SELF_MONITORING",
        },

        accessGrant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccessGrant",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model(
    "VitalReading",
    vitalReadingSchema
);