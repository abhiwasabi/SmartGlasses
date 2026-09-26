import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(
          Date.now() + 30 * 60 * 1000
        ).toISOString(),

        newSessionExpireTime: new Date(
          Date.now() + 60 * 1000
        ),
      },
    });

    return res.status(200).json({
      token: token.name,
    });
  } catch (error) {
    console.error("Failed to create Gemini token:", error);

    return res.status(500).json({
      error: "Failed to create Gemini token",
    });
  }
}