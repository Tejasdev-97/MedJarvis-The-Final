import Patient from "../models/Patient.js";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import AuditLog from "../models/AuditLog.js";
import generateMedJarvisId from "../utils/generateMedJarvisId.js";
import bcrypt from "bcryptjs";

/**
 * Bulk Import / Bulk Update Controller
 * Handles server-side validation, RBAC enforcement, duplicate handling,
 * record creation/updating, provenance tracking, and audit logging.
 */
export const bulkImportRecords = async (req, res) => {
    try {
        const { entityType = "Patients", rows = [], options = {} } = req.body;

        const userRole = req.user?.role || "Patient";
        const profileId = req.user?.profileId || req.user?.id;
        const accountId = req.user?.accountId || req.user?.id;

        // ========================================================
        // 1. RBAC PERMISSION ENFORCEMENT
        // ========================================================
        const allowedEntitiesByRole = {
            "Super Admin": ["Patients", "Doctors", "Health Workers", "Staff"],
            "Hospital Manager": ["Patients", "Doctors", "Health Workers", "Staff"],
            "Health Worker": ["Patients"],
            "Doctor": ["Patients"],
            "Patient": [],
            "Ambulance Staff": [],
        };

        const permittedEntities = allowedEntitiesByRole[userRole] || [];

        if (!permittedEntities.includes(entityType)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: Your role (${userRole}) is not permitted to bulk import ${entityType}.`,
            });
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No import rows provided.",
            });
        }

        // Batch tracking metadata
        const bulkImportId = `BULK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const importedAt = new Date();

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        const rowResults = [];

        // ========================================================
        // 2. PROCESS ENTITIES
        // ========================================================
        if (entityType === "Patients") {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 1;

                try {
                    const firstName = String(row.firstName || "").trim();
                    const lastName = String(row.lastName || "").trim();
                    const phone = String(row.phone || "").trim();
                    const age = Number(row.age) || 0;
                    const gender = String(row.gender || "Other").trim();
                    const bloodGroup = String(row.bloodGroup || "O+").trim().toUpperCase();
                    const emergencyContact = String(row.emergencyContact || phone).trim();
                    const village = String(row.village || "Default Village").trim();
                    const address = String(row.address || village || "Default Address").trim();
                    const actionPreference = String(row._action || "AUTO").toUpperCase(); // AUTO, CREATE, UPDATE, SKIP

                    if (!firstName || !lastName || !phone) {
                        failedCount++;
                        rowResults.push({
                            rowNumber,
                            status: "FAILED",
                            message: "Missing required fields (First Name, Last Name, or Phone).",
                            data: row,
                        });
                        continue;
                    }

                    if (actionPreference === "SKIP") {
                        skippedCount++;
                        rowResults.push({
                            rowNumber,
                            status: "SKIPPED",
                            message: "Row explicitly marked to skip.",
                            data: row,
                        });
                        continue;
                    }

                    // Check for existing patient by phone
                    let existingPatient = await Patient.findOne({ phone });

                    if (!existingPatient && row.medJarvisId) {
                        existingPatient = await Patient.findOne({ medJarvisId: row.medJarvisId });
                    }

                    if (existingPatient) {
                        // UPDATE PATH
                        if (actionPreference === "CREATE") {
                            failedCount++;
                            rowResults.push({
                                rowNumber,
                                status: "FAILED",
                                message: `Cannot CREATE: Patient with phone ${phone} already exists (${existingPatient.medJarvisId}).`,
                                data: row,
                            });
                            continue;
                        }

                        // Update existing patient record
                        existingPatient.firstName = firstName || existingPatient.firstName;
                        existingPatient.lastName = lastName || existingPatient.lastName;
                        if (age > 0) existingPatient.age = age;
                        existingPatient.gender = gender || existingPatient.gender;
                        existingPatient.bloodGroup = bloodGroup || existingPatient.bloodGroup;
                        existingPatient.emergencyContact = emergencyContact || existingPatient.emergencyContact;
                        existingPatient.village = village || existingPatient.village;
                        existingPatient.address = address || existingPatient.address;
                        if (row.aadhaarNumber) existingPatient.aadhaarNumber = String(row.aadhaarNumber).trim();
                        if (row.district) existingPatient.district = String(row.district).trim();
                        if (row.state) existingPatient.state = String(row.state).trim();
                        if (row.pincode) existingPatient.pincode = String(row.pincode).trim();

                        existingPatient.bulkImportId = bulkImportId;
                        existingPatient.importedAt = importedAt;
                        existingPatient.importedBy = profileId;

                        await existingPatient.save();

                        updatedCount++;
                        rowResults.push({
                            rowNumber,
                            status: "UPDATED",
                            message: `Updated existing patient ${existingPatient.medJarvisId}`,
                            recordId: existingPatient._id,
                            medJarvisId: existingPatient.medJarvisId,
                        });
                    } else {
                        // CREATE PATH
                        if (actionPreference === "UPDATE") {
                            failedCount++;
                            rowResults.push({
                                rowNumber,
                                status: "FAILED",
                                message: `Cannot UPDATE: Patient with phone ${phone} does not exist.`,
                                data: row,
                            });
                            continue;
                        }

                        const medJarvisId = row.medJarvisId || (await generateMedJarvisId());

                        const newPatient = await Patient.create({
                            medJarvisId,
                            firstName,
                            lastName,
                            age: age > 0 ? age : 30,
                            gender: ["Male", "Female", "Other"].includes(gender) ? gender : "Other",
                            bloodGroup,
                            phone,
                            emergencyContact,
                            village,
                            address,
                            aadhaarNumber: row.aadhaarNumber ? String(row.aadhaarNumber).trim() : "",
                            district: row.district ? String(row.district).trim() : "",
                            state: row.state ? String(row.state).trim() : "Karnataka",
                            pincode: row.pincode ? String(row.pincode).trim() : "",
                            createdBy: profileId,
                            createdSource: "BULK_IMPORT",
                            bulkImportId,
                            importedAt,
                            importedBy: profileId,
                            status: "Healthy",
                        });

                        // Ensure User Account & Patient Profile exist
                        let userAccount = await User.findOne({ phone });

                        if (!userAccount) {
                            const hashedPin = await bcrypt.hash("1234", 10);
                            userAccount = await User.create({
                                phone,
                                pin: hashedPin,
                            });
                        }

                        let patientProfile = await Profile.findOne({ patient: newPatient._id });

                        if (!patientProfile) {
                            await Profile.create({
                                account: userAccount._id,
                                role: "Patient",
                                displayName: `${firstName} ${lastName}`,
                                patient: newPatient._id,
                                isDefault: true,
                            });
                        }

                        createdCount++;
                        rowResults.push({
                            rowNumber,
                            status: "CREATED",
                            message: `Registered new patient ${medJarvisId}`,
                            recordId: newPatient._id,
                            medJarvisId,
                        });
                    }
                } catch (rowErr) {
                    console.error(`Error processing bulk row ${i + 1}:`, rowErr);
                    failedCount++;
                    rowResults.push({
                        rowNumber: i + 1,
                        status: "FAILED",
                        message: rowErr.message || "Database insert error",
                    });
                }
            }
        } else {
            // Processing Doctors / Health Workers / Staff Profiles
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 1;

                try {
                    const displayName = String(row.displayName || `${row.firstName || ''} ${row.lastName || ''}`).trim();
                    const phone = String(row.phone || "").trim();
                    const targetRole = entityType === "Doctors" ? "Doctor" : entityType === "Health Workers" ? "Health Worker" : "Hospital Staff";
                    const employeeId = String(row.employeeId || `EMP-${Date.now()}-${i}`).trim();

                    if (!displayName || !phone) {
                        failedCount++;
                        rowResults.push({
                            rowNumber,
                            status: "FAILED",
                            message: "Missing Name or Phone number.",
                        });
                        continue;
                    }

                    let userAccount = await User.findOne({ phone });

                    if (!userAccount) {
                        const hashedPin = await bcrypt.hash("1234", 10);
                        userAccount = await User.create({ phone, pin: hashedPin });
                    }

                    let profile = await Profile.findOne({ account: userAccount._id, role: targetRole });

                    if (profile) {
                        profile.displayName = displayName;
                        profile.employeeId = employeeId;
                        await profile.save();
                        updatedCount++;
                        rowResults.push({
                            rowNumber,
                            status: "UPDATED",
                            message: `Updated ${targetRole} profile for ${displayName}`,
                            recordId: profile._id,
                        });
                    } else {
                        profile = await Profile.create({
                            account: userAccount._id,
                            role: targetRole,
                            displayName,
                            employeeId,
                            hospital: row.hospital || "General Hospital",
                        });
                        createdCount++;
                        rowResults.push({
                            rowNumber,
                            status: "CREATED",
                            message: `Created ${targetRole} profile for ${displayName}`,
                            recordId: profile._id,
                        });
                    }
                } catch (profileErr) {
                    failedCount++;
                    rowResults.push({
                        rowNumber: i + 1,
                        status: "FAILED",
                        message: profileErr.message || "Failed to process profile row",
                    });
                }
            }
        }

        // ========================================================
        // 3. AUDIT LOG ENTRY
        // ========================================================
        try {
            const auditUser = accountId || profileId;
            const logDetails = `Bulk Import [${bulkImportId}] - Entity: ${entityType}. Total: ${rows.length}, Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}. Performed by role: ${userRole}.`;

            await AuditLog.create({
                user: auditUser,
                action: `BULK_IMPORT_${entityType.toUpperCase().replace(/\s+/g, "_")}`,
                details: logDetails,
            });
        } catch (auditErr) {
            console.warn("Failed to write bulk import audit log:", auditErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Bulk import completed for ${entityType}`,
            data: {
                bulkImportId,
                entityType,
                summary: {
                    total: rows.length,
                    created: createdCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    failed: failedCount,
                },
                rowResults,
            },
        });

    } catch (error) {
        console.error("BULK IMPORT CONTROLLER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Server error during bulk import execution.",
        });
    }
};
