import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
    {
        medJarvisId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        age: {
            type: Number,
            required: true,
        },

        gender: {
            type: String,
            enum: ["Male", "Female", "Other"],
            required: true,
        },

        bloodGroup: {
            type: String,
            required: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        emergencyContact: {
            type: String,
            required: true,
        },

        photo: {
            type: String,
            default: "",
        },

        dateOfBirth: {
            type: Date,
        },

        aadhaarNumber: {
            type: String,
            default: "",
        },

        district: {
            type: String,
            default: "",
        },

        state: {
            type: String,
            default: "Karnataka",
        },

        pincode: {
            type: String,
            default: "",
        },

        village: {
            type: String,
            required: true,
        },

        address: {
            type: String,
            required: true,
        },

        allergies: {
            type: [String],
            default: [],
        },

        medicalHistory: {
            type: [String],
            default: [],
        },

        medications: {
            type: [String],
            default: [],
        },

        aiSummary: {
            type: String,
            default: "",
        },

        aiSummaryGeneratedAt: {
            type: Date,
            default: null,
        },

        aiSummaryModel: {
            type: String,
            default: "",
        },

        healthCardVersion: {
            type: Number,
            default: 1,
        },

        wearableAssigned: {
            type: Boolean,
            default: false,
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            required: true,
        },

        createdSource: {
            type: String,
            enum: ["MANUAL", "BULK_IMPORT"],
            default: "MANUAL",
        },

        bulkImportId: {
            type: String,
            default: null,
        },

        importedAt: {
            type: Date,
            default: null,
        },

        importedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Profile",
            default: null,
        },

        status: {
            type: String,
            enum: ["Healthy", "Observation", "Critical"],
            default: "Healthy",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Patient", patientSchema);