import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ============================================================
// CONSENT PIN
//
// Physical consent fallback for rural / no-smartphone patients.
// A hashed PIN the patient can physically hand to a provider.
//
// A PIN alone is NEVER sufficient for full medical access.
// It must be combined with:
//   - provider identity (JWT authenticated)
//   - purpose declaration
//   - short duration
//   - scope selection
//   - audit log creation
//
// Rate limiting: tracks failed attempts to prevent brute force.
// ============================================================

const consentPinSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
            unique: true,
            index: true,
        },

        // bcrypt-hashed 6-digit PIN
        pinHash: {
            type: String,
            required: true,
        },

        // Display-friendly hint (never the actual PIN)
        hint: {
            type: String,
            default: "Last 2 digits of your date of birth",
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        // Rate limiting
        failedAttempts: {
            type: Number,
            default: 0,
        },

        lastFailedAt: {
            type: Date,
            default: null,
        },

        lockedUntil: {
            type: Date,
            default: null,
        },

        rotatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Static: generate a random 6-digit PIN, return plaintext + hash
consentPinSchema.statics.generatePin = async function () {
    const pin = String(
        Math.floor(100000 + Math.random() * 900000)
    );
    const pinHash = await bcrypt.hash(pin, 12);
    return { pin, pinHash };
};

// Instance: verify submitted PIN with rate-limit protection
consentPinSchema.methods.verifyPin = async function (submitted) {
    const now = new Date();

    // Check lockout
    if (this.lockedUntil && this.lockedUntil > now) {
        const secondsLeft = Math.ceil(
            (this.lockedUntil - now) / 1000
        );
        throw new Error(
            `Too many failed attempts. Try again in ${secondsLeft} seconds.`
        );
    }

    if (!this.isActive) {
        throw new Error("Consent PIN has been revoked.");
    }

    const match = await bcrypt.compare(submitted, this.pinHash);

    if (!match) {
        this.failedAttempts += 1;
        this.lastFailedAt = now;

        // Lock for 10 minutes after 5 failures
        if (this.failedAttempts >= 5) {
            this.lockedUntil = new Date(now.getTime() + 10 * 60 * 1000);
        }

        await this.save();
        return false;
    }

    // Reset on success
    this.failedAttempts = 0;
    this.lastFailedAt = null;
    this.lockedUntil = null;
    await this.save();

    return true;
};

export default mongoose.model("ConsentPin", consentPinSchema);
