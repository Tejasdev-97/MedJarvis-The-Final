import mongoose from "mongoose";

const doctorVisitSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
        },

        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            required: true,
        },

        visitDate: {
            type: Date,
            default: Date.now,
        },

        // ── Raw transcript captured by voice recorder ──
        rawTranscript: {
            type: String,
            default: "",
        },

        // ── Structured fields (AI-extracted or manually entered) ──
        chiefComplaint: {
            type: String,
            default: "",
        },

        symptoms: {
            type: [String],
            default: [],
        },

        clinicalNotes: {
            type: String,
            default: "",
        },

        followUpDate: {
            type: Date,
            default: null,
        },

        // ── Human confirmation gate ──
        confirmedAt: {
            type: Date,
            default: null,
        },

        // ── Source of content ──
        source: {
            type: String,
            enum: ["VOICE", "MANUAL"],
            default: "MANUAL",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("DoctorVisit", doctorVisitSchema);
