import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";

import {
    requestAccess,
    approveAccess,
    denyAccess,
    revokeAccess,
    useConsentPin,
    emergencyAccess,
    getMyPatients,
    getGrantsForPatient,
    getPendingRequests,
    getAccessLedger,
    setupConsentPin,
} from "../controllers/accessGrantController.js";

const router = express.Router();

// ============================================================
// PROVIDER ROUTES
// ============================================================

// Request consent from a patient
router.post(
    "/request",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Super Admin"
    ),
    requestAccess
);

// Physical consent PIN fallback
router.post(
    "/consent-pin",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Ambulance Staff"
    ),
    useConsentPin
);

// Emergency break-glass
router.post(
    "/emergency",
    protect,
    authorizeRoles("Ambulance Staff", "Doctor", "Super Admin"),
    emergencyAccess
);

// Get MY patients (patients who granted this provider access)
router.get(
    "/my-patients",
    protect,
    authorizeRoles(
        "Doctor",
        "Health Worker",
        "Hospital Manager",
        "Ambulance Staff",
        "Super Admin"
    ),
    getMyPatients
);

// ============================================================
// PATIENT ROUTES
// ============================================================

// View pending access requests
router.get(
    "/pending",
    protect,
    authorizeRoles("Patient"),
    getPendingRequests
);

// View all active grants (privacy dashboard)
router.get(
    "/my-grants",
    protect,
    authorizeRoles("Patient"),
    getGrantsForPatient
);

// Full access ledger (audit trail)
router.get(
    "/ledger",
    protect,
    authorizeRoles("Patient"),
    getAccessLedger
);

// Setup / rotate consent PIN
router.post(
    "/setup-pin",
    protect,
    authorizeRoles("Patient"),
    setupConsentPin
);

// Approve a pending request
router.patch(
    "/:grantId/approve",
    protect,
    authorizeRoles("Patient"),
    approveAccess
);

// Deny a pending request
router.patch(
    "/:grantId/deny",
    protect,
    authorizeRoles("Patient"),
    denyAccess
);

// Revoke an active grant
router.patch(
    "/:grantId/revoke",
    protect,
    authorizeRoles("Patient"),
    revokeAccess
);

export default router;
