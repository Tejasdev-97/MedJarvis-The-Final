import express from "express";

import {
    createEmergencyEvent,
    resolveEmergencyEvent,
    getEmergencyEvent,
} from "../controllers/emergencyController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// ESP32 / frontend → create emergency event (no auth — ESP32 posts directly)
router.post("/", createEmergencyEvent);

// Frontend → resolve emergency (requires auth)
router.patch("/:eventId/resolve", protect, resolveEmergencyEvent);

// Frontend → get event details (requires auth)
router.get("/:eventId", protect, getEmergencyEvent);

export default router;