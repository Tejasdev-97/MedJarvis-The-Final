import express from "express";

import {
    createPatient,
    getPatients,
    getPatient,
    updatePatient,
    deletePatient,
    scanPatient,
} from "../controllers/patientController.js";

import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import requirePatientAccess from "../middleware/requirePatientAccess.js";

const router = express.Router();

// ============================================================
// CREATE PATIENT
// Health Workers, Hospital Managers, Doctor, Super Admin
// ============================================================
router.post(
    "/",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker"
    ),
    createPatient
);

// ============================================================
// GET ALL PATIENTS (MY PATIENTS — consent-gated for staff)
// Staff only gets patients they have active AccessGrants for.
// Super Admin gets full directory.
// ============================================================
router.get(
    "/",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Ambulance Staff"
    ),
    getPatients
);

// ============================================================
// SCAN PATIENT BY MEDJARVIS ID  (QR scan)
// Any authenticated staff can scan — returns minimal identity only.
// Full medical access still requires a consent grant.
// ============================================================
router.get(
    "/scan/:medJarvisId",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Ambulance Staff"
    ),
    scanPatient
);

// ============================================================
// GET SINGLE PATIENT FULL PROFILE
// requirePatientAccess enforces consent-gate for staff.
// Patient accessing their own profile is allowed via SELF path.
// ============================================================
router.get(
    "/:id",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Doctor",
        "Health Worker",
        "Ambulance Staff",
        "Patient"
    ),
    requirePatientAccess({ scope: "PROFILE", idParam: "id" }),
    getPatient
);

// ============================================================
// UPDATE PATIENT  (Super Admin, Hospital Manager, Health Worker)
// ============================================================
router.put(
    "/:id",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Health Worker"
    ),
    requirePatientAccess({ scope: "PROFILE", idParam: "id" }),
    updatePatient
);

// ============================================================
// DELETE PATIENT  (Super Admin, Hospital Manager, Health Worker)
// ============================================================
router.delete(
    "/:id",
    protect,
    authorizeRoles(
        "Super Admin",
        "Hospital Manager",
        "Health Worker"
    ),
    deletePatient
);

export default router;