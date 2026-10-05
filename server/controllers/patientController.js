import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Patient from "../models/Patient.js";
import AccessGrant from "../models/AccessGrant.js";
import DoctorVisit from "../models/DoctorVisit.js";
import Prescription from "../models/Prescription.js";
import VitalReading from "../models/VitalReading.js";
import generateMedJarvisId from "../utils/generateMedJarvisId.js";
import createAuditLog from "../utils/createAuditLog.js";

// ============================================================
// Create Patient
// Only Health Workers, Hospital Managers, Super Admin can register.
// ============================================================
export const createPatient = async (req, res) => {
    try {
        const {
            phone,
            firstName,
            lastName,
        } = req.body;

        // Prevent duplicate accounts
        const existingUser = await User.findOne({ phone });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Phone Number Already Registered",
            });
        }

        const medJarvisId = await generateMedJarvisId();

        // Create Patient
        const patient = await Patient.create({
            ...req.body,
            medJarvisId,
            createdBy: req.user.profileId,
        });

        // Create User Account
        const hashedPin = await bcrypt.hash("1234", 10);

        const account = await User.create({
            phone,
            pin: hashedPin,
        });

        // Create Patient Profile
        const profile = await Profile.create({
            account: account._id,
            role: "Patient",
            displayName: `${firstName} ${lastName}`,
            patient: patient._id,
            isDefault: true,
        });

        await createAuditLog({
            user: req.user.accountId,
            patient: patient._id,
            action: "CREATE_PATIENT",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "CREATE_PATIENT",
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(201).json({
            success: true,
            message:
                "Patient Registered Successfully. Default PIN: 1234",
            data: {
                patient,
                account,
                profile,
            },
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message,
        });

    }
};

// ============================================================
// Get All Patients
//
// SECURITY: Staff can only list patients they have an active
// consent grant for (MY PATIENTS).
//
// Super Admin gets the full list (limited fields only).
//
// ============================================================
// Get All Patients
//
// SECURITY: Non-Admin staff can list patients with whom they have
// a legitimate care relationship (historical or active access, visits,
// creation, prescriptions, vitals). Includes real-time isConsented
// and hasActiveAccess flags so that medical-data actions remain gated.
// ============================================================
export const getPatients = async (req, res) => {
    try {
        const providerProfileId = req.user.profileId;
        const now = new Date();
        const { search } = req.query;

        // Super Admin handling: full directory
        if (req.user.role === "Super Admin") {
            const filter = { isDeleted: { $ne: true } };
            if (search) {
                const q = search.trim();
                filter.$or = [
                    { medJarvisId: q },
                    { phone: q },
                    { firstName: new RegExp(q, "i") },
                    { lastName: new RegExp(q, "i") },
                ];
            }

            const patients = await Patient.find(filter)
                .select("firstName lastName medJarvisId phone gender dateOfBirth bloodGroup createdAt")
                .sort({ createdAt: -1 })
                .lean();

            const data = patients.map((p) => ({
                ...p,
                isConsented: true,
                hasActiveAccess: true,
                grantId: "SUPER_ADMIN",
                scopes: ["ALL"],
                grantedAt: p.createdAt,
                expiresAt: null,
                purpose: "Super Admin Access",
            }));

            return res.status(200).json({
                success: true,
                count: data.length,
                data,
            });
        }

        // 1. Fetch active grants map for provider
        const activeGrants = await AccessGrant.find({
            provider: providerProfileId,
            status: { $in: ["ACTIVE", "EMERGENCY"] },
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: now } },
            ],
        })
            .sort({ grantedAt: -1 })
            .lean();

        const activeGrantsMap = new Map();
        activeGrants.forEach((g) => {
            const pId = g.patient?.toString();
            if (pId && !activeGrantsMap.has(pId)) {
                activeGrantsMap.set(pId, g);
            }
        });

        // 2. Fetch all distinct patient IDs linked by legitimate care relationships
        const [grantPatientIds, createdPatients, visitPatients, rxPatients, vitalPatients] = await Promise.all([
            AccessGrant.distinct("patient", { provider: providerProfileId }),
            Patient.distinct("_id", {
                $or: [{ createdBy: providerProfileId }, { importedBy: providerProfileId }],
                isDeleted: { $ne: true },
            }),
            DoctorVisit.distinct("patient", { doctor: providerProfileId }),
            Prescription.distinct("patient", { doctor: providerProfileId }),
            VitalReading.distinct("patient", { recordedByProfile: providerProfileId }),
        ]);

        const relatedIdsRaw = [
            ...grantPatientIds,
            ...createdPatients,
            ...visitPatients,
            ...rxPatients,
            ...vitalPatients,
        ].filter(Boolean);

        const relatedSet = new Set(relatedIdsRaw.map((id) => id.toString()));

        if (relatedSet.size === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                data: [],
            });
        }

        // 3. Query patients strictly constrained to relatedSet (anti-enumeration)
        const queryFilter = {
            _id: { $in: Array.from(relatedSet) },
            isDeleted: { $ne: true },
        };

        if (search) {
            const q = search.trim();
            queryFilter.$or = [
                { medJarvisId: q },
                { phone: q },
                { firstName: new RegExp(q, "i") },
                { lastName: new RegExp(q, "i") },
            ];
        }

        const patients = await Patient.find(queryFilter)
            .select("firstName lastName medJarvisId dateOfBirth gender phone bloodGroup createdAt")
            .sort({ createdAt: -1 })
            .lean();

        // 4. Map patients with real-time access status
        const data = patients.map((patient) => {
            const activeGrant = activeGrantsMap.get(patient._id.toString());
            const hasActiveAccess = Boolean(activeGrant);
            return {
                ...patient,
                isConsented: hasActiveAccess,
                hasActiveAccess: hasActiveAccess,
                grantId: activeGrant ? activeGrant._id : null,
                scopes: activeGrant ? activeGrant.scopes : [],
                grantedAt: activeGrant ? activeGrant.grantedAt : null,
                expiresAt: activeGrant ? activeGrant.expiresAt : null,
                purpose: activeGrant ? activeGrant.purpose : "",
            };
        });

        return res.status(200).json({
            success: true,
            count: data.length,
            data,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// Get Single Patient
//
// The requirePatientAccess middleware must already have passed
// before this function is reached for staff users.
// For patient self-access the middleware allows it directly.
// ============================================================
export const getPatient = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient Not Found",
            });
        }

        await createAuditLog({
            user: req.user.accountId,
            patient: patient._id,
            action: "VIEW_PATIENT_PROFILE",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "VIEW_PATIENT_PROFILE",
            accessGrantId: req.accessGrant?._id || null,
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(200).json({
            success: true,
            data: patient,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// Update Patient
// Only Super Admin and Hospital Manager
// ============================================================
export const updatePatient = async (req, res) => {
    try {
        if (req.user?.role === "Doctor") {
            return res.status(403).json({
                success: false,
                message: "Doctors are not authorized to edit patient records.",
            });
        }

        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
            }
        );

        await createAuditLog({
            user: req.user.accountId,
            patient: req.params.id,
            action: "UPDATE_PATIENT",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "UPDATE_PATIENT",
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(200).json({
            success: true,
            message: "Patient Updated",
            data: patient,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// Delete Patient
// ============================================================
export const deletePatient = async (req, res) => {
    try {
        if (req.user?.role === "Doctor") {
            return res.status(403).json({
                success: false,
                message: "Doctors are not authorized to delete patient records.",
            });
        }

        await Patient.findByIdAndDelete(req.params.id);

        await createAuditLog({
            user: req.user.accountId,
            patient: req.params.id,
            action: "DELETE_PATIENT",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "DELETE_PATIENT",
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(200).json({
            success: true,
            message: "Patient Deleted",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// Scan Patient (by MedJarvis ID)
//
// Used by QR scanning. Returns ONLY basic identity fields
// regardless of consent. Full medical data requires a grant.
//
// This is intentionally minimal — "MedJarvis ID ≠ permission".
// ============================================================
export const scanPatient = async (req, res) => {
    try {
        const { medJarvisId } = req.params;

        const patient = await Patient.findOne({
            medJarvisId,
        }).select(
            "firstName lastName medJarvisId dateOfBirth gender phone bloodGroup _id"
        );

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found",
            });
        }

        await createAuditLog({
            user: req.user.accountId,
            patient: patient._id,
            action: "QR_SCAN",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "QR_SCAN",
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.json({
            success: true,
            data: patient,
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message,
        });

    }
};