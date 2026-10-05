/**
 * Translation Controller
 * Supports backend Google Translation API proxying if GOOGLE_TRANSLATE_API_KEY is configured.
 * Priority 1 in MedJarvis Multilingual Pipeline.
 */
export const translateText = async (req, res) => {
    try {
        const { text, targetLang = "hi" } = req.body;

        const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: "Backend Google Translation API key is not configured.",
                fallbackRequired: true,
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: "Text parameter is required.",
            });
        }

        // Call Google Cloud Translation API v2
        const response = await fetch(
            `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    q: text,
                    target: targetLang,
                    format: "text",
                }),
            }
        );

        const data = await response.json();

        if (response.ok && data?.data?.translations?.[0]?.translatedText) {
            return res.status(200).json({
                success: true,
                translatedText: data.data.translations[0].translatedText,
                source: "BACKEND_GTS",
            });
        }

        const isRateLimit = data?.error?.message?.toLowerCase().includes("rate limit") || response.status === 429;

        return res.status(isRateLimit ? 429 : 400).json({
            success: false,
            rateLimited: isRateLimit,
            message: isRateLimit
                ? "Google Cloud Translation API rate limit exceeded. Enable billing in Google Cloud Console or wait a few minutes."
                : data.error?.message || "Google Translation service returned an error.",
            fallbackRequired: true,
        });
    } catch (error) {
        console.error("Backend GTS error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to contact Google Translation Service.",
            fallbackRequired: true,
        });
    }
};

export const getTranslationStatus = async (req, res) => {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    const isConfigured = Boolean(apiKey && apiKey.trim().length > 0);
    return res.status(200).json({
        success: true,
        configured: isConfigured,
        source: isConfigured ? "BACKEND_ENV" : "NONE",
        message: isConfigured
            ? "Backend Google Translation API key is configured and active."
            : "No backend Google Translation API key configured in server .env."
    });
};
