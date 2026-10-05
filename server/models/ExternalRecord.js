import mongoose from "mongoose";

// ============================================================
// EXTERNAL HEALTH RECORD
//
// Stores health records imported from external facilities:
// hospitals, laboratories, pharmacies, vaccination centres,
// other healthcare providers.
//
// ABHA-inspired patient-controlled longitudinal record.
// Does NOT claim official ABDM/ABHA interoperability.
//
// Every record carries full provenance so the AI summary
// and clinical staff can clearly distinguish:
//   MedJarvis internal data vs. external facility records.
// ============================================================

const externalRecordSchema = new mongoose.Schema(
    {
        // ── Patient ───────────────────────────────────────────
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
            index: true,
        },

        // ── Record metadata ───────────────────────────────────
        title: {
            type: String,
            required: true,
            trim: true,
        },

        recordType: {
            type: String,
            enum: [
                "LAB_REPORT",
                "HOSPITAL_DISCHARGE",
                "PRESCRIPTION",
                "VACCINATION",
                "RADIOLOGY",
                "PATHOLOGY",
                "REFERRAL",
                "CONSULTATION",
                "OTHER",
            ],
            required: true,
        },

        recordDate: {
            type: Date,
            required: true,
        },

        summary: {
            type: String,
            default: "",
        },

        // ── Source / Provenance ───────────────────────────────
        facilityName: {
            type: String,
            required: true,
            trim: true,
        },

        facilityType: {
            type: String,
            enum: [
                "GOVERNMENT_HOSPITAL",
                "PRIVATE_HOSPITAL",
                "PHC",
                "LABORATORY",
                "PHARMACY",
                "VACCINATION_CENTRE",
                "CLINIC",
                "OTHER",
            ],
            default: "OTHER",
        },

        facilityLocation: {
            type: String,
            default: "",
        },

        attendingProvider: {
            type: String,
            default: "",
        },

        // ── Document reference ────────────────────────────────
        // Stores a URL, base64 data-URI, or file reference.
        documentUrl: {
            type: String,
            default: "",
        },

        documentMimeType: {
            type: String,
            default: "",
        },

        // ── Import context ────────────────────────────────────
        importedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            default: null,
        },

        importedAt: {
            type: Date,
            default: Date.now,
        },

        importSource: {
            type: String,
            enum: [
                "MANUAL_ENTRY",
                "DOCUMENT_UPLOAD",
                "QR_SCAN",
                "BULK_IMPORT",
            ],
            default: "MANUAL_ENTRY",
        },

        // ── Verification ──────────────────────────────────────
        isVerified: {
            type: Boolean,
            default: false,
        },

        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            default: null,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },

        verificationNote: {
            type: String,
            default: "",
        },

        // ── Consent context ───────────────────────────────────
        // Which access grant permitted the import of this record.
        consentGrantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AccessGrant",
            default: null,
        },

        // ── Soft delete ───────────────────────────────────────
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

externalRecordSchema.index({ patient: 1, recordDate: -1 });
externalRecordSchema.index({ patient: 1, recordType: 1 });

export default mongoose.model("ExternalRecord", externalRecordSchema);
