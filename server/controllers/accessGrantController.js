import AccessGrant from "../models/AccessGrant.js";
import ConsentPin from "../models/ConsentPin.js";
import Patient from "../models/Patient.js";
import Profile from "../models/Profile.js";
import DoctorVisit from "../models/DoctorVisit.js";
import Prescription from "../models/Prescription.js";
import VitalReading from "../models/VitalReading.js";
import createAuditLog from "../utils/createAuditLog.js";

// ============================================================
// Access Grant Controller
//
// Handles the full consent lifecycle:
//   requestAccess         — Provider asks for patient consent
//   approveAccess         — Patient approves
//   denyAccess            — Patient denies
//   revokeAccess          — Patient revokes existing grant
//   useConsentPin         — Physical PIN flow (rural fallback)
//   emergencyAccess       — Break-glass for Ambulance Staff
//   getMyPatients         — Provider: list patients who granted me access
//   getGrantsForPatient   — Patient: see all providers who have access
//   getPendingRequests     — Patient: pending access requests awaiting decision
//   getAccessLedger        — Patient: full history of who accessed their data
// ============================================================

// ──────────────────────────────────────────────────────────────
// REQUEST ACCESS
// A provider requests consent from a patient.
// Creates a PENDING AccessGrant; patient must approve via app.
// ──────────────────────────────────────────────────────────────
export const requestAccess = async (req, res) => {
    try {
        const {
            patientId,
            purpose,
            scopes,
            requestMessage,
            durationHours,
        } = req.body;

        if (!patientId || !purpose || !scopes?.length) {
            return res.status(400).json({
                success: false,
                message: "patientId, purpose, and scopes are required.",
            });
        }

        const patient = await Patient.findById(patientId).lean();
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: "Patient not found.",
            });
        }

        const provider = await Profile.findById(req.user.profileId).lean();

        // Check if an active grant already exists
        const existing = await AccessGrant.findOne({
            patient: patientId,
            provider: req.user.profileId,
            status: { $in: ["ACTIVE", "PENDING"] },
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message:
                    existing.status === "ACTIVE"
                        ? "You already have active access to this patient."
                        : "You already have a pending access request for this patient.",
            });
        }

        const expiresAt = durationHours
            ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
            : null;

        const grant = await AccessGrant.create({
            patient: patientId,
            provider: req.user.profileId,
            providerRole: req.user.role,
            facility: provider?.hospital || "",
            purpose,
            scopes,
            requestMessage: requestMessage || "",
            consentMethod: "DOCTOR_REQUEST",
            status: "PENDING",
            expiresAt,
        });

        await createAuditLog({
            user: req.user.accountId,
            patient: patientId,
            action: "CONSENT_REQUEST",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "CONSENT_REQUEST",
            accessGrantId: grant._id,
            purpose,
            dataCategories: scopes,
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(201).json({
            success: true,
            message: "Access request sent. Patient must approve to grant access.",
            data: grant,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// APPROVE ACCESS  (patient only)
// ──────────────────────────────────────────────────────────────
export const approveAccess = async (req, res) => {
    try {
        const { grantId } = req.params;
        const { scopes, durationHours } = req.body;

        // Resolve patient from logged-in Patient profile
        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        const grant = await AccessGrant.findById(grantId);

        if (!grant) {
            return res.status(404).json({ success: false, message: "Grant not found." });
        }

        if (grant.patient.toString() !== profile?.patient?.toString()) {
            return res.status(403).json({ success: false, message: "Not your data." });
        }

        if (grant.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Grant is already ${grant.status}.`,
            });
        }

        grant.status = "ACTIVE";
        grant.grantedAt = new Date();
        grant.consentMethod = "DOCTOR_REQUEST";

        // Patient may narrow scopes at approval time
        if (scopes?.length) {
            grant.scopes = scopes;
        }

        if (durationHours) {
            grant.expiresAt = new Date(
                Date.now() + durationHours * 60 * 60 * 1000
            );
        }

        await grant.save();

        await createAuditLog({
            user: req.user.accountId,
            patient: grant.patient,
            action: "CONSENT_GRANTED",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "CONSENT_GRANTED",
            accessGrantId: grant._id,
            dataCategories: grant.scopes,
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.json({
            success: true,
            message: "Access granted successfully.",
            data: grant,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// DENY ACCESS  (patient only)
// ──────────────────────────────────────────────────────────────
export const denyAccess = async (req, res) => {
    try {
        const { grantId } = req.params;

        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        const grant = await AccessGrant.findById(grantId);

        if (!grant) {
            return res.status(404).json({ success: false, message: "Grant not found." });
        }

        if (grant.patient.toString() !== profile?.patient?.toString()) {
            return res.status(403).json({ success: false, message: "Not your data." });
        }

        grant.status = "DENIED";
        await grant.save();

        await createAuditLog({
            user: req.user.accountId,
            patient: grant.patient,
            action: "CONSENT_DENIED",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "CONSENT_DENIED",
            accessGrantId: grant._id,
            result: "DENIED",
            ipAddress: req.ip || "",
        });

        res.json({ success: true, message: "Access request denied." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// REVOKE ACCESS  (patient only)
// Patient revokes a previously active grant.
// ──────────────────────────────────────────────────────────────
export const revokeAccess = async (req, res) => {
    try {
        const { grantId } = req.params;

        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        const grant = await AccessGrant.findById(grantId);

        if (!grant) {
            return res.status(404).json({ success: false, message: "Grant not found." });
        }

        if (grant.patient.toString() !== profile?.patient?.toString()) {
            return res.status(403).json({ success: false, message: "Not your data." });
        }

        if (!["ACTIVE", "EMERGENCY"].includes(grant.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot revoke a ${grant.status} grant.`,
            });
        }

        grant.status = "REVOKED";
        grant.revokedAt = new Date();
        await grant.save();

        await createAuditLog({
            user: req.user.accountId,
            patient: grant.patient,
            action: "CONSENT_REVOKED",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "CONSENT_REVOKED",
            accessGrantId: grant._id,
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.json({ success: true, message: "Access revoked successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// USE CONSENT PIN  (provider + physical PIN)
// Rural fallback. Provider enters PIN given by patient.
// Creates an ACTIVE grant with limited scope + short duration.
// ──────────────────────────────────────────────────────────────
export const useConsentPin = async (req, res) => {
    try {
        const {
            patientId,
            pin,
            purpose,
            scopes,
            durationHours = 4,
        } = req.body;

        if (!patientId || !pin || !purpose) {
            return res.status(400).json({
                success: false,
                message: "patientId, pin, and purpose are required.",
            });
        }

        const patient = await Patient.findById(patientId).lean();
        if (!patient) {
            return res.status(404).json({ success: false, message: "Patient not found." });
        }

        const consentPin = await ConsentPin.findOne({ patient: patientId });

        if (!consentPin || !consentPin.isActive) {
            return res.status(403).json({
                success: false,
                message: "Consent PIN not set up for this patient.",
            });
        }

        let verified = false;
        try {
            verified = await consentPin.verifyPin(pin);
        } catch (err) {
            await createAuditLog({
                user: req.user.accountId,
                patient: patientId,
                action: "CONSENT_PIN_FAILED",
                profile: req.user.profileId,
                role: req.user.role,
                actionCategory: "CONSENT_PIN_FAILED",
                result: "DENIED",
                details: err.message,
                ipAddress: req.ip || "",
            });

            return res.status(403).json({ success: false, message: err.message });
        }

        if (!verified) {
            return res.status(403).json({
                success: false,
                message: "Incorrect consent PIN.",
            });
        }

        const provider = await Profile.findById(req.user.profileId).lean();

        const expiresAt = new Date(
            Date.now() + durationHours * 60 * 60 * 1000
        );

        const allowedScopes = scopes?.length
            ? scopes
            : ["PROFILE", "EMERGENCY_BASIC"];

        const grant = await AccessGrant.create({
            patient: patientId,
            provider: req.user.profileId,
            providerRole: req.user.role,
            facility: provider?.hospital || "",
            purpose,
            scopes: allowedScopes,
            consentMethod: "CONSENT_PIN",
            status: "ACTIVE",
            grantedAt: new Date(),
            expiresAt,
            consentPinUsed: true,
        });

        await createAuditLog({
            user: req.user.accountId,
            patient: patientId,
            action: "CONSENT_PIN_USED",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "CONSENT_PIN_USED",
            accessGrantId: grant._id,
            consentMethod: "CONSENT_PIN",
            purpose,
            dataCategories: allowedScopes,
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(201).json({
            success: true,
            message: "Consent PIN verified. Access granted.",
            data: grant,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// EMERGENCY BREAK-GLASS ACCESS
// Ambulance Staff only. Creates EMERGENCY grant with minimal scope.
// ──────────────────────────────────────────────────────────────
export const emergencyAccess = async (req, res) => {
    try {
        const { patientId, emergencyReason } = req.body;

        if (!patientId || !emergencyReason) {
            return res.status(400).json({
                success: false,
                message: "patientId and emergencyReason are required.",
            });
        }

        const patient = await Patient.findById(patientId).lean();
        if (!patient) {
            return res.status(404).json({ success: false, message: "Patient not found." });
        }

        const provider = await Profile.findById(req.user.profileId).lean();

        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

        const grant = await AccessGrant.create({
            patient: patientId,
            provider: req.user.profileId,
            providerRole: req.user.role,
            facility: provider?.hospital || "AMBULANCE",
            purpose: "EMERGENCY",
            scopes: ["EMERGENCY_BASIC", "ALLERGIES", "PROFILE"],
            consentMethod: "EMERGENCY_BREAK_GLASS",
            status: "EMERGENCY",
            isEmergency: true,
            emergencyReason,
            grantedAt: new Date(),
            expiresAt,
        });

        await createAuditLog({
            user: req.user.accountId,
            patient: patientId,
            action: `EMERGENCY_ACCESS: ${emergencyReason}`,
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "EMERGENCY_ACCESS",
            accessGrantId: grant._id,
            isEmergency: true,
            emergencyReason,
            dataCategories: ["EMERGENCY_BASIC"],
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        res.status(201).json({
            success: true,
            message: "Emergency access granted. Patient will be notified.",
            data: grant,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET MY PATIENTS  (provider)
// Returns all patients with a legitimate care relationship to this provider.
// Includes real-time isConsented and hasActiveAccess flags so that unconsented
// historical relationship patients require fresh access requests.
// ──────────────────────────────────────────────────────────────
export const getMyPatients = async (req, res) => {
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
                .select("firstName lastName medJarvisId dateOfBirth gender phone bloodGroup createdAt")
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

            return res.json({ success: true, count: data.length, data });
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
            return res.json({ success: true, count: 0, data: [] });
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

        return res.json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET GRANTS FOR PATIENT  (patient — their privacy dashboard)
// Returns who currently has access and what scope.
// ──────────────────────────────────────────────────────────────
export const getGrantsForPatient = async (req, res) => {
    try {
        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        if (!profile?.patient) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not linked.",
            });
        }

        const now = new Date();

        const grants = await AccessGrant.find({
            patient: profile.patient,
            status: { $in: ["ACTIVE", "EMERGENCY", "PENDING"] },
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: now } },
            ],
        })
            .populate({
                path: "provider",
                select: "displayName role hospital employeeId",
            })
            .sort({ requestedAt: -1 })
            .lean();

        res.json({ success: true, data: grants });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET PENDING REQUESTS  (patient — requests awaiting approval)
// ──────────────────────────────────────────────────────────────
export const getPendingRequests = async (req, res) => {
    try {
        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        if (!profile?.patient) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not linked.",
            });
        }

        const grants = await AccessGrant.find({
            patient: profile.patient,
            status: "PENDING",
        })
            .populate({
                path: "provider",
                select: "displayName role hospital employeeId",
            })
            .sort({ requestedAt: -1 })
            .lean();

        res.json({ success: true, data: grants });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET ACCESS LEDGER  (patient)
// Full audit history of who accessed their data.
// ──────────────────────────────────────────────────────────────
export const getAccessLedger = async (req, res) => {
    try {
        const AuditLog = (await import("../models/AuditLog.js")).default;

        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        if (!profile?.patient) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not linked.",
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;

        const logs = await AuditLog.find({ patient: profile.patient })
            .populate({
                path: "profile",
                select: "displayName role hospital",
            })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const total = await AuditLog.countDocuments({
            patient: profile.patient,
        });

        res.json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// SETUP CONSENT PIN  (patient only)
// Patient creates or rotates their physical consent PIN.
// Returns the plain PIN ONCE — never stored in plaintext.
// ──────────────────────────────────────────────────────────────
export const setupConsentPin = async (req, res) => {
    try {
        const profile = await Profile.findById(req.user.profileId)
            .select("patient")
            .lean();

        if (!profile?.patient) {
            return res.status(404).json({
                success: false,
                message: "Patient profile not linked.",
            });
        }

        const { pin, pinHash } = await ConsentPin.generatePin();

        await ConsentPin.findOneAndUpdate(
            { patient: profile.patient },
            {
                patient: profile.patient,
                pinHash,
                isActive: true,
                failedAttempts: 0,
                lastFailedAt: null,
                lockedUntil: null,
                rotatedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        await createAuditLog({
            user: req.user.accountId,
            patient: profile.patient,
            action: "CONSENT_PIN_SETUP",
            profile: req.user.profileId,
            role: req.user.role,
            actionCategory: "OTHER",
            result: "SUCCESS",
            ipAddress: req.ip || "",
        });

        // Return plain PIN only this one time
        res.json({
            success: true,
            message:
                "Consent PIN set. Save this PIN — it will not be shown again.",
            pin,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
