import mongoose from "mongoose";

// ============================================================
// AUDIT LOG  (extended — backward compatible)
//
// Every sensitive patient-data access is logged here.
// The original fields (user, patient, action, details, ipAddress)
// are preserved.  New fields are all optional (default: null/"")
// so existing code that only fills old fields continues to work.
// ============================================================

const auditLogSchema = new mongoose.Schema(
    {
        // ── Original fields (KEEP as-is) ──────────────────────
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            default: null,
        },

        action: {
            type: String,
            required: true,
        },

        details: {
            type: String,
            default: "",
        },

        ipAddress: {
            type: String,
            default: "",
        },

        // ── Extended fields (NEW — all optional) ──────────────

        // The Profile (role context) doing the action
        profile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            default: null,
        },

        role: {
            type: String,
            default: "",
        },

        facility: {
            type: String,
            default: "",
        },

        // e.g. VIEW_PATIENT_PROFILE, VIEW_VITALS, DOWNLOAD_HEALTH_CARD
        actionCategory: {
            type: String,
            enum: [
                "VIEW_PATIENT_PROFILE",
                "VIEW_VITALS",
                "VIEW_PRESCRIPTIONS",
                "VIEW_MEDICAL_HISTORY",
                "VIEW_VISIT_NOTES",
                "VIEW_EXTERNAL_RECORD",
                "VIEW_AI_SUMMARY",
                "VIEW_TIMELINE",
                "DOWNLOAD_HEALTH_CARD",
                "CREATE_PRESCRIPTION",
                "UPDATE_PATIENT",
                "DELETE_PATIENT",
                "CREATE_PATIENT",
                "QR_SCAN",
                "CONSENT_REQUEST",
                "CONSENT_GRANTED",
                "CONSENT_DENIED",
                "CONSENT_REVOKED",
                "CONSENT_EXPIRED",
                "EMERGENCY_ACCESS",
                "CONSENT_PIN_USED",
                "CONSENT_PIN_FAILED",
                "OTHER",
            ],
            default: "OTHER",
        },

        // Which consent/access grant authorized this action
        accessGrantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccessGrant",
            default: null,
        },

        consentMethod: {
            type: String,
            default: "",
        },

        purpose: {
            type: String,
            default: "",
        },

        // Data categories accessed (for patient-facing history)
        dataCategories: {
            type: [String],
            default: [],
        },

        // Emergency override details
        isEmergency: {
            type: Boolean,
            default: false,
        },

        emergencyReason: {
            type: String,
            default: "",
        },

        // Result
        result: {
            type: String,
            enum: ["SUCCESS", "DENIED", "ERROR", ""],
            default: "SUCCESS",
        },
    },
    {
        timestamps: true,
    }
);

auditLogSchema.index({ patient: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ actionCategory: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);