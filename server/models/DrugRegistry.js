import mongoose from "mongoose";

// ============================================================
// DRUG REGISTRY
//
// MedJarvis Drug Information Registry.
// Local curated dataset — NOT connected to an official national
// database unless explicitly integrated.
//
// Integrates with the existing deterministic Drug Interaction
// Checker (client/src/data/drugInteractions.js).
// Does NOT replace it.
// ============================================================

const drugRegistrySchema = new mongoose.Schema(
    {
        // ── Identification ────────────────────────────────────
        genericName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },

        brandNames: {
            type: [String],
            default: [],
        },

        // Normalized lowercase for search matching
        searchKeys: {
            type: [String],
            default: [],
        },

        // ── Classification ────────────────────────────────────
        drugClass: {
            type: String,
            default: "",
        },

        atcCode: {
            type: String,
            default: "",
        },

        // ── Formulation ───────────────────────────────────────
        dosageForms: {
            type: [String],
            default: [],
        },

        strengths: {
            type: [String],
            default: [],
        },

        routeOfAdministration: {
            type: [String],
            default: [],
        },

        // ── Clinical information ──────────────────────────────
        indications: {
            type: [String],
            default: [],
        },

        contraindications: {
            type: [String],
            default: [],
        },

        warnings: {
            type: [String],
            default: [],
        },

        sideEffects: {
            type: [String],
            default: [],
        },

        // ── Interaction cross-reference ───────────────────────
        // Interaction logic lives in the deterministic engine.
        // This field lists drug names that SHOULD be checked
        // by that engine when this drug is prescribed.
        interactionAlerts: {
            type: [String],
            default: [],
        },

        // ── Manufacturer / Regulatory ─────────────────────────
        manufacturer: {
            type: String,
            default: "",
        },

        regulatoryStatus: {
            type: String,
            enum: [
                "APPROVED",
                "RESTRICTED",
                "WITHDRAWN",
                "INVESTIGATIONAL",
                "OTC",
                "UNKNOWN",
            ],
            default: "UNKNOWN",
        },

        referenceSource: {
            type: String,
            default: "MedJarvis Drug Registry",
        },

        // ── Special categories ────────────────────────────────
        isControlledSubstance: {
            type: Boolean,
            default: false,
        },

        requiresMonitoring: {
            type: Boolean,
            default: false,
        },

        pregnancyCategory: {
            type: String,
            default: "",
        },

        // ── Search/status ─────────────────────────────────────
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

drugRegistrySchema.index({ genericName: "text", brandNames: "text" });
drugRegistrySchema.index({ searchKeys: 1 });

export default mongoose.model("DrugRegistry", drugRegistrySchema);
