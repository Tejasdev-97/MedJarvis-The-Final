/**
 * accessGrantService.js
 *
 * Frontend service for all access-grant / consent operations.
 * Uses the shared axios instance from api.js (auto-injects JWT).
 */

import api from "./api";

// ── PROVIDER ──────────────────────────────────────────────────

/** Request consent from a patient */
export const requestAccess = (data) =>
    api.post("/access-grants/request", data);

/** Use a physical consent PIN (rural fallback) */
export const useConsentPin = (data) =>
    api.post("/access-grants/consent-pin", data);

/** Emergency break-glass access */
export const emergencyAccess = (data) =>
    api.post("/access-grants/emergency", data);

/** Get MY patients (patients who granted me access) */
export const getMyPatients = () =>
    api.get("/access-grants/my-patients");

// ── PATIENT ───────────────────────────────────────────────────

/** Get pending access requests */
export const getPendingRequests = () =>
    api.get("/access-grants/pending");

/** Get all active grants (privacy dashboard) */
export const getMyGrants = () =>
    api.get("/access-grants/my-grants");

/** Full access ledger */
export const getAccessLedger = (page = 1, limit = 25) =>
    api.get(`/access-grants/ledger?page=${page}&limit=${limit}`);

/** Setup / rotate consent PIN */
export const setupConsentPin = () =>
    api.post("/access-grants/setup-pin");

/** Approve a pending grant */
export const approveGrant = (grantId, data = {}) =>
    api.patch(`/access-grants/${grantId}/approve`, data);

/** Deny a pending grant */
export const denyGrant = (grantId) =>
    api.patch(`/access-grants/${grantId}/deny`);

/** Revoke an active grant */
export const revokeGrant = (grantId) =>
    api.patch(`/access-grants/${grantId}/revoke`);
