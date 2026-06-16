import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API route for categorization
  app.post("/api/categorize", async (req, res) => {
    try {
      const { transactions, categories, rules } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        console.warn("WARNING: GEMINI_API_KEY environment variable is not defined.");
        return res.status(400).json({ error: "Configuração do servidor pendente. Adicione a variável de ambiente GEMINI_API_KEY no painel Settings > Secrets do AI Studio." });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const rulesList = (rules || []).map((r: any) => `- Padrão Título: "${r.title}"  --> Categoria ID: ${r.categoryId} (${r.categoryName})`).join('\n');

      const prompt = `
You are an AI that categorizes financial transactions for lawyers. 
Here are the existing categories:
${categories.map((c: any) => `- ID: ${c.id}, Name: ${c.name}${c.parentId ? ` (Subcategory of ${categories.find((p:any) => p.id === c.parentId)?.name || 'Unknown'})` : ''}`).join('\n')}

We also have some historically categorized rules by the user. Use these examples to guide your decision-making for similar titles:
${rulesList || '(No rules provided)'}

For the following transactions, identify and assign the best matching category ID from the list. If no specific category is a good match, default to the ID of "Outros".

Transactions to categorize:
${transactions.map((t: any) => `- ID: ${t.id}, Title: ${t.title}, Amount: ${t.amount}`).join('\n')}
`;

      let response;
      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              transactionId: {
                type: Type.STRING,
                description: "The ID of the transaction."
              },
              categoryId: {
                type: Type.STRING,
                description: "The ID of the best matching category."
              }
            },
            required: ["transactionId", "categoryId"]
          }
        }
      };

      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config
        });
      } catch (firstErr) {
        console.warn("Generating with gemini-2.5-flash failed, attempting with gemini-3.5-flash...", firstErr);
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config
          });
        } catch (secondErr) {
          console.error("AI Generation failed on all models:", secondErr);
          throw new Error("Erro de comunicação com o serviço de IA do Google Gemini. Verifique a chave de API.");
        }
      }

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini.");
      }

      const results = JSON.parse(text.trim());
      res.json(results);
    } catch (error) {
      console.error("AI categorization error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to categorize" });
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
