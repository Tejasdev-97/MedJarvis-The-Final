import AuditLog from "../models/AuditLog.js";

// ============================================================
// createAuditLog
//
// Backward-compatible: original callers (user, patient, action,
// details, ipAddress) still work unchanged.
//
// Extended callers may additionally provide:
//   profile, role, facility, actionCategory, accessGrantId,
//   consentMethod, purpose, dataCategories,
//   isEmergency, emergencyReason, result
// ============================================================

const createAuditLog = async ({
    user,
    patient = null,
    action,
    details = "",
    ipAddress = "",
    // ── Extended fields ──
    profile = null,
    role = "",
    facility = "",
    actionCategory = "OTHER",
    accessGrantId = null,
    consentMethod = "",
    purpose = "",
    dataCategories = [],
    isEmergency = false,
    emergencyReason = "",
    result = "SUCCESS",
}) => {
    try {
        await AuditLog.create({
            user,
            patient,
            action,
            details,
            ipAddress,
            profile,
            role,
            facility,
            actionCategory,
            accessGrantId,
            consentMethod,
            purpose,
            dataCategories,
            isEmergency,
            emergencyReason,
            result,
        });
    } catch (error) {
        // Audit log failures must never crash the main request
        console.error("Audit Log Error:", error.message);
    }
};

export default createAuditLog;