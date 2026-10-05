import { GoogleGenAI } from "@google/genai";

export async function generateGeminiResponse({
    prompt,
    apiKey,
    model,
}) {
    const finalKey =
        apiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.GEMINI_KEY;

    if (!finalKey) {
        return {
            success: false,
            message: "Gemini API key not configured.",
        };
    }

    try {
        const ai = new GoogleGenAI({
            apiKey: finalKey,
        });

        const selectedModel =
            model ||
            process.env.GEMINI_MODEL ||
            "gemini-2.0-flash";

        let response;
        try {
            response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
            });
        } catch (modelErr) {
            console.warn(
                `Gemini model ${selectedModel} failed, trying gemini-2.0-flash fallback:`,
                modelErr.message
            );
            response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt,
            });
        }

        return {
            success: true,
            text: response.text,
        };
    } catch (err) {
        console.error("========== GEMINI ERROR ==========");
        console.error(err.message || err);
        console.error("==================================");

        return {
            success: false,
            message: err.message || "Gemini request failed.",
        };
    }
}