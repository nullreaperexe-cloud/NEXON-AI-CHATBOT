import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper method to execute requests with backup models to avoid 503 Spikes in demand error
async function generateContentWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    systemInstruction?: string;
    maxOutputTokens?: number;
  }
) {
  // Let's try 3.5-flash (main stable latest) first, then 3.1-pro-preview (complex reasoning backup), and 3.1-flash-lite as rapid fallback
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[NEXON MAINFRAME] Routing neuro-synaptic signals to ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          maxOutputTokens: options.maxOutputTokens,
        },
      });
      console.log(`[NEXON MAINFRAME] Connection sustained via ${model}.`);
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      console.warn(`[NEXON MAINFRAME] Model ${model} is experiencing network resistance:`, err.message || err);
    }
  }
  throw lastError || new Error("All active neural synaptic gates are currently unresponsive.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Route - Validate API Key
  app.post("/api/validate-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "API Key is required." });
      }

      // Initialize the Gemini SDK with the user-provided API key
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Call verification with fallback logic
      const { modelUsed } = await generateContentWithFallback(ai, {
        contents: "Ping",
        maxOutputTokens: 5,
      });

      return res.json({ valid: true, model: modelUsed });
    } catch (error: any) {
      console.error("API Key Verification Failed:", error);
      const message = error.message || "Invalid API Key. Please check the key and try again.";
      return res.status(401).json({ error: message });
    }
  });

  // API Route - Interact with Gemini Chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { apiKey, message, attachment, history, systemInstruction } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "NEXON requires an active API Key." });
      }
      if (!message && !attachment) {
        return res.status(400).json({ error: "Message content or attachment cannot be empty." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Format messages in the Google GenAI structure:
      // content: { role: 'user' | 'model', parts: [{ text: string }, { inlineData: { mimeType, data } }] }
      const contents = [
        ...(history || []).map((msg: any) => {
          const parts: any[] = [{ text: msg.text || "" }];
          if (msg.attachment && msg.attachment.mimeType && msg.attachment.data) {
            parts.push({
              inlineData: {
                mimeType: msg.attachment.mimeType,
                data: msg.attachment.data
              }
            });
          }
          return {
            role: msg.role === "user" ? "user" : "model",
            parts: parts
          };
        }),
        {
          role: "user",
          parts: (() => {
            const parts: any[] = [{ text: message || "" }];
            if (attachment && attachment.mimeType && attachment.data) {
              parts.push({
                inlineData: {
                  mimeType: attachment.mimeType,
                  data: attachment.data
                }
              });
            }
            return parts;
          })()
        }
      ];

      const { response, modelUsed } = await generateContentWithFallback(ai, {
        contents: contents,
        systemInstruction: systemInstruction || "You are NEXON, an advanced intelligence cyberpunk AI chatbot assistant. You are cool, futuristic, sharp, and highly technical. Use cyberpunk slang sparingly (e.g. 'sys-op', 'runner', 'datanet'), represent yourself with glowing cybernetic symbols, write perfectly structured responses with beautiful Markdown (tables, headings, clean lists, bold elements) and accurate code snippet formatting. Always stand tall, operate as an elite intelligence, and deliver ultra-premium help."
      });

      const text = response.text || "No response received.";
      return res.json({ text, model: modelUsed });
    } catch (error: any) {
      console.error("NEXON API Server Error:", error);
      return res.status(500).json({ error: error.message || "An error occurred during communication." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NEXON SERVER] Cybernetic engine online on port ${PORT}`);
  });
}

startServer();
