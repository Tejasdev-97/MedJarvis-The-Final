import express from "express";
import { translateText, getTranslationStatus } from "../controllers/translationController.js";

const router = express.Router();

// Translation proxy endpoint
router.post("/translate", translateText);
router.get("/status", getTranslationStatus);

export default router;
