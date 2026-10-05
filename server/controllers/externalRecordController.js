import ExternalRecord from "../models/ExternalRecord.js";
import Profile from "../models/Profile.js";
import createAuditLog from "../utils/createAuditLog.js";

// ============================================================
// EXTERNAL RECORDS CONTROLLER
//
// Patient-controlled external health records.
// Staff may also upload records with patient consent (via grant).
// The requirePatientAccess middleware must run before these
// handlers on all staff-facing routes.
// ============================================================

// ──────────────────────────────────────────────────────────────
// ADD EXTERNAL RECORD
// Patient adds their own record, OR staff adds with consent.
// ──────────────────────────────────────────────────────────────
export const addExternalRecord = async (req, res) => {
    try {
        let patientId;

        if (req.user.role === "Patient") {
            const profile = await Profile.findById(req.user.profileId)
                .select("patient")
                .lean();

            if (!profile?.patient) {
                return res.status(404).json({
                    success: false,
                    message: "Patient profile not linked.",
                });
            }

            patientId = profile.patient;
        } else {
            patientId = req.body.patientId;

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    message: "patientId is required.",
                });
            }
        }

        const {
            title,
            recordType,
            recordDate,
            summary,
            facilityName,
            facilityType,
            facilityLocation,
            attendingProvider,
            documentUrl,
            documentMimeType,
            importSource,
        } = req.body;

        if (!title || !recordType || !recordDate || !facilityName) {
            return res.status(400).json({
                success: false,
                message: "title, recordType, recordDate, and facilityName are required.",
            });
        }

        const record = await ExternalRecord.create({
            patient: patientId,
            title,
            recordType,
            recordDate,
            summary: summary || "",
            facilityName,
            facilityType: facilityType || "OTHER",
            facilityLocation: facilityLocation || "",
            attendingProvider: attendingProvider || "",
            documentUrl: documentUrl || "",
            documentMimeType: documentMimeType || "",
            importedBy: req.user.profileId,
            importSource: importSource || "MANUAL_ENTRY",
            consentGrantId: req.accessGrant?._id || null,
        });

        await createAuditLog({
            user: req.user.accountId,
            patient: patientId,
            action: `ADD_EXTERNAL_RECORD: ${title}`,
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "VIEW_EXTERNAL_RECORD",
            accessGrantId: req.accessGrant?._id || null,
            dataCategories: ["EXTERNAL_RECORDS"],
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(201).json({
            success: true,
            message: "External record added successfully.",
            data: record,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET PATIENT EXTERNAL RECORDS
// ──────────────────────────────────────────────────────────────
export const getExternalRecords = async (req, res) => {
    try {
        let patientId;

        if (req.user.role === "Patient") {
            const profile = await Profile.findById(req.user.profileId)
                .select("patient")
                .lean();
            patientId = profile?.patient;
        } else {
            patientId = req.params.patientId;
        }

        if (!patientId) {
            return res.status(400).json({
                success: false,
                message: "Patient not found.",
            });
        }

        const { recordType, page = 1, limit = 20 } = req.query;

        const query = {
            patient: patientId,
            isDeleted: false,
        };

        if (recordType) {
            query.recordType = recordType;
        }

        const records = await ExternalRecord.find(query)
            .populate("importedBy", "displayName role")
            .populate("verifiedBy", "displayName role")
            .sort({ recordDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        const total = await ExternalRecord.countDocuments(query);

        await createAuditLog({
            user: req.user.accountId,
            patient: patientId,
            action: "VIEW_EXTERNAL_RECORDS",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "VIEW_EXTERNAL_RECORD",
            accessGrantId: req.accessGrant?._id || null,
            dataCategories: ["EXTERNAL_RECORDS"],
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.json({
            success: true,
            data: records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET SINGLE EXTERNAL RECORD
// ──────────────────────────────────────────────────────────────
export const getExternalRecord = async (req, res) => {
    try {
        const record = await ExternalRecord.findById(req.params.id)
            .populate("importedBy", "displayName role")
            .populate("verifiedBy", "displayName role")
            .lean();

        if (!record || record.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Record not found.",
            });
        }

        res.json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// VERIFY RECORD  (Doctor / Hospital Manager / Super Admin)
// ──────────────────────────────────────────────────────────────
export const verifyExternalRecord = async (req, res) => {
    try {
        const { verificationNote } = req.body;

        const record = await ExternalRecord.findByIdAndUpdate(
            req.params.id,
            {
                isVerified: true,
                verifiedBy: req.user.profileId,
                verifiedAt: new Date(),
                verificationNote: verificationNote || "",
            },
            { new: true }
        );

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found.",
            });
        }

        res.json({
            success: true,
            message: "Record verified.",
            data: record,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// SOFT DELETE RECORD  (patient only deletes their own)
// ──────────────────────────────────────────────────────────────
export const deleteExternalRecord = async (req, res) => {
    try {
        const record = await ExternalRecord.findById(req.params.id);

        if (!record || record.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Record not found.",
            });
        }

        // Patient can only delete their own record
        if (req.user.role === "Patient") {
            const profile = await Profile.findById(req.user.profileId)
                .select("patient")
                .lean();

            if (record.patient.toString() !== profile?.patient?.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Not your record.",
                });
            }
        }

        record.isDeleted = true;
        await record.save();

        res.json({ success: true, message: "Record deleted." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
