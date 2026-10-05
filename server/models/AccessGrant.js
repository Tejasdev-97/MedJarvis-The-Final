import mongoose from "mongoose";

// ============================================================
// ACCESS GRANT
//
// Records every patient-authorized provider access session.
// This is the authoritative record for WHO may currently
// access WHICH patient data and HOW.
//
// Grant lifecycle:
//   PENDING  -> Doctor requested; patient has not yet responded.
//   ACTIVE   -> Patient approved; provider may access.
//   DENIED   -> Patient explicitly denied.
//   EXPIRED  -> expiresAt has passed; no longer valid.
//   REVOKED  -> Patient manually revoked before expiry.
//   EMERGENCY -> Break-glass emergency override (limited scope).
// ============================================================

const accessGrantSchema = new mongoose.Schema(
    {
        // ── WHO is being accessed ──────────────────────────
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
            index: true,
        },

        // ── WHO is doing the accessing ──────────────────────
        provider: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            required: true,
            index: true,
        },

        // ── Provider's role at time of grant ────────────────
        providerRole: {
            type: String,
            enum: [
                "Doctor",
                "Health Worker",
                "Hospital Manager",
                "Ambulance Staff",
                "Super Admin",
            ],
            required: true,
        },

        // ── Facility context ─────────────────────────────────
        facility: {
            type: String,
            default: "",
        },

        // ── Purpose ──────────────────────────────────────────
        purpose: {
            type: String,
            default: "",
        },

        // ── How consent was established ──────────────────────
        consentMethod: {
            type: String,
            enum: [
                "DOCTOR_REQUEST",       // Doctor requested → Patient approved via app
                "PATIENT_QR",           // Patient scanned provider QR → Patient approved
                "CONSENT_PIN",          // Physical consent card PIN (rural fallback)
                "EMERGENCY_BREAK_GLASS",// Emergency override
                "SUPER_ADMIN",          // Super Admin system access
            ],
            required: true,
        },

        // ── Data scope patient chose to share ────────────────
        scopes: {
            type: [String],
            enum: [
                "PROFILE",
                "MEDICAL_HISTORY",
                "PRESCRIPTIONS",
                "VITALS",
                "VISIT_NOTES",
                "MONITORING",
                "ALLERGIES",
                "EXTERNAL_RECORDS",
                "AI_SUMMARY",
                "EMERGENCY_BASIC",  // Break-glass minimal set
                "ALL",              // Super Admin / full authorized access
            ],
            default: ["PROFILE"],
        },

        // ── Lifecycle ─────────────────────────────────────────
        status: {
            type: String,
            enum: [
                "PENDING",
                "ACTIVE",
                "DENIED",
                "EXPIRED",
                "REVOKED",
                "EMERGENCY",
            ],
            default: "PENDING",
            index: true,
        },

        // ── Timing ───────────────────────────────────────────
        grantedAt: {
            type: Date,
            default: null,
        },

        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },

        revokedAt: {
            type: Date,
            default: null,
        },

        // ── Emergency specific ────────────────────────────────
        isEmergency: {
            type: Boolean,
            default: false,
        },

        emergencyReason: {
            type: String,
            default: "",
        },

        // ── Consent PIN reference (for physical card fallback) ─
        consentPinUsed: {
            type: Boolean,
            default: false,
        },

        // ── Request context ───────────────────────────────────
        requestedAt: {
            type: Date,
            default: Date.now,
        },

        requestMessage: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient "does this provider have active access to patient?" queries
accessGrantSchema.index({
    patient: 1,
    provider: 1,
    status: 1,
    expiresAt: 1,
});

export default mongoose.model("AccessGrant", accessGrantSchema);
