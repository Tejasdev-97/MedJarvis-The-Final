import express from "express";
import { bulkImportRecords } from "../controllers/bulkImportController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Bulk import endpoint — RBAC checked inside controller and middleware
router.post("/import", protect, bulkImportRecords);

export default router;
