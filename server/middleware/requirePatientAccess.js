import AccessGrant from "../models/AccessGrant.js";
import Profile from "../models/Profile.js";
import createAuditLog from "../utils/createAuditLog.js";

// ============================================================
// PATIENT ACCESS MIDDLEWARE
//
// Enforces relationship-based authorization for any route that
// accesses patient medical data.
//
// USAGE:
//   import requirePatientAccess from "../middleware/requirePatientAccess.js";
//   router.get("/:patientId", protect, requirePatientAccess(), handler);
//
// ORDER OF ACCESS CHECKS:
//   1. Patient accessing their OWN data  → allowed
//   2. Super Admin                       → allowed (all categories)
//   3. Emergency access                  → minimal scope allowed
//   4. Active, non-expired AccessGrant   → allowed for granted scopes
//   5. Everything else                   → 403
//
// OPTIONS:
//   scope (string)   — one of the AccessGrant scopes enum values.
//                      If the grant does not include this scope,
//                      the request is rejected.
//   allowSelf (bool) — default true. Set false if a route must
//                      NOT be reached by the patient themselves.
//
// The patientId is read from req.params.patientId by default.
// You can override this with the idParam option.
// ============================================================

const requirePatientAccess = ({
    scope = null,
    allowSelf = true,
    idParam = "patientId",
    audit = true,
} = {}) => {
    return async (req, res, next) => {
        try {
            const patientId =
                req.params[idParam] ||
                req.body?.patientId ||
                req.query?.patientId;

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    message: "Patient ID is required.",
                });
            }

            const requesterId = req.user?.profileId;
            const requesterRole = req.user?.role;
            const accountId = req.user?.accountId;

            // ── 1. Patient accessing their own data ──────────
            if (allowSelf && requesterRole === "Patient") {
                const profile = await Profile.findById(requesterId)
                    .select("patient role")
                    .lean();

                if (
                    profile?.patient &&
                    profile.patient.toString() === patientId
                ) {
                    req.accessType = "SELF";
                    req.accessGrant = null;
                    return next();
                }

                // Patient trying to access another patient's data
                await _denyAndLog({
                    req,
                    patientId,
                    reason: "Patients may only access their own records.",
                    audit,
                });

                return res.status(403).json({
                    success: false,
                    message: "Access denied.",
                });
            }

            // ── 2. Super Admin bypass ─────────────────────────
            if (requesterRole === "Super Admin") {
                req.accessType = "SUPER_ADMIN";
                req.accessGrant = null;

                if (audit) {
                    await createAuditLog({
                        user: accountId,
                        patient: patientId,
                        action: `SUPER_ADMIN_ACCESS [${scope || "ALL"}]`,
                        profile: requesterId,
                        role: requesterRole,
                        actionCategory: _scopeToCategory(scope),
                        dataCategories: scope ? [scope] : ["ALL"],
                        result: "SUCCESS",
                        ipAddress: req.ip || "",
                    });
                }

                return next();
            }

            // ── 3. Emergency break-glass ───────────────────────
            // For Ambulance Staff with an active emergency grant
            const emergencyGrant = await AccessGrant.findOne({
                patient: patientId,
                provider: requesterId,
                status: "EMERGENCY",
                isEmergency: true,
            })
                .sort({ requestedAt: -1 })
                .lean();

            if (emergencyGrant) {
                req.accessType = "EMERGENCY";
                req.accessGrant = emergencyGrant;

                if (audit) {
                    await createAuditLog({
                        user: accountId,
                        patient: patientId,
                        action: `EMERGENCY_ACCESS [${scope || "EMERGENCY_BASIC"}]`,
                        profile: requesterId,
                        role: requesterRole,
                        actionCategory: "EMERGENCY_ACCESS",
                        accessGrantId: emergencyGrant._id,
                        isEmergency: true,
                        emergencyReason: emergencyGrant.emergencyReason || "",
                        dataCategories: ["EMERGENCY_BASIC"],
                        result: "SUCCESS",
                        ipAddress: req.ip || "",
                    });
                }

                return next();
            }

            // ── 4. Active AccessGrant check ───────────────────
            const now = new Date();

            const grant = await AccessGrant.findOne({
                patient: patientId,
                provider: requesterId,
                status: "ACTIVE",
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: now } },
                ],
            })
                .sort({ grantedAt: -1 })
                .lean();

            if (!grant) {
                await _denyAndLog({
                    req,
                    patientId,
                    reason: "No active access grant found.",
                    audit,
                });

                return res.status(403).json({
                    success: false,
                    message:
                        "Access denied. You do not have an active consent grant for this patient. " +
                        "Request access or ask the patient to grant consent.",
                    code: "NO_ACTIVE_GRANT",
                });
            }

            // ── Scope check ───────────────────────────────────
            if (scope) {
                const hasScope =
                    grant.scopes.includes("ALL") ||
                    grant.scopes.includes(scope);

                if (!hasScope) {
                    await _denyAndLog({
                        req,
                        patientId,
                        reason: `Grant does not include scope: ${scope}`,
                        audit,
                        grantId: grant._id,
                    });

                    return res.status(403).json({
                        success: false,
                        message:
                            `Access denied. Your patient's consent does not include "${scope}" data.`,
                        code: "SCOPE_DENIED",
                    });
                }
            }

            // ── Grant is valid ────────────────────────────────
            req.accessType = "GRANTED";
            req.accessGrant = grant;

            if (audit) {
                await createAuditLog({
                    user: accountId,
                    patient: patientId,
                    action: `GRANTED_ACCESS [${scope || "GENERAL"}]`,
                    profile: requesterId,
                    role: requesterRole,
                    facility: grant.facility || "",
                    actionCategory: _scopeToCategory(scope),
                    accessGrantId: grant._id,
                    consentMethod: grant.consentMethod || "",
                    purpose: grant.purpose || "",
                    dataCategories: scope ? [scope] : grant.scopes,
                    result: "SUCCESS",
                    ipAddress: req.ip || "",
                });
            }

            return next();
        } catch (error) {
            console.error("requirePatientAccess error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Authorization check failed.",
            });
        }
    };
};

// ── Helpers ────────────────────────────────────────────────────

async function _denyAndLog({ req, patientId, reason, audit, grantId = null }) {
    if (!audit) return;

    await createAuditLog({
        user: req.user?.accountId,
        patient: patientId,
        action: `ACCESS_DENIED: ${reason}`,
        profile: req.user?.profileId,
        role: req.user?.role,
        actionCategory: "OTHER",
        accessGrantId: grantId,
        result: "DENIED",
        ipAddress: req.ip || "",
    });
}

function _scopeToCategory(scope) {
    const map = {
        PROFILE: "VIEW_PATIENT_PROFILE",
        MEDICAL_HISTORY: "VIEW_MEDICAL_HISTORY",
        PRESCRIPTIONS: "VIEW_PRESCRIPTIONS",
        VITALS: "VIEW_VITALS",
        VISIT_NOTES: "VIEW_VISIT_NOTES",
        MONITORING: "VIEW_VITALS",
        ALLERGIES: "VIEW_PATIENT_PROFILE",
        EXTERNAL_RECORDS: "VIEW_EXTERNAL_RECORD",
        AI_SUMMARY: "VIEW_AI_SUMMARY",
        EMERGENCY_BASIC: "EMERGENCY_ACCESS",
        ALL: "VIEW_PATIENT_PROFILE",
    };
    return map[scope] || "OTHER";
}

export default requirePatientAccess;
