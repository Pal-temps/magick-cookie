import { Hono } from "hono";
import type { LlmService } from "../../application/llm/llm.service";

export function createCodeRoutes(llmService: LlmService) {
  const app = new Hono();

  app.post("/explain", async (c) => {
    const { code, language, question } = await c.req.json<{ code: string; language?: string; question?: string }>();
    const prompt = question
      ? `Explique ce code ${language ?? ""} en repondant a cette question : "${question}"\n\nCode:\n\`\`\`${language ?? ""}\n${code}\n\`\`\``
      : `Explique ce code ${language ?? ""} de maniere claire et concise. Identifie le but, la logique principale, et les points importants.\n\nCode:\n\`\`\`${language ?? ""}\n${code}\n\`\`\``;

    const result = await llmService.chat([
      { role: "system", content: "Tu es un assistant de programmation expert. Reponds en francais. Sois concis et precis." },
      { role: "user", content: prompt },
    ]);
    return c.json({ data: result });
  });

  app.post("/refactor", async (c) => {
    const { code, language, instruction } = await c.req.json<{ code: string; language?: string; instruction?: string }>();
    const prompt = `Refactorise ce code ${language ?? ""}${instruction ? ` selon cette instruction : "${instruction}"` : ""}. Retourne UNIQUEMENT le code refactorise dans un bloc \`\`\`${language ?? ""}\`\`\`, suivi d'une breve explication des changements.\n\nCode original:\n\`\`\`${language ?? ""}\n${code}\n\`\`\``;

    const result = await llmService.chat([
      { role: "system", content: "Tu es un expert en refactoring de code. Ameliore la lisibilite, les performances et la maintenabilite. Reponds en francais." },
      { role: "user", content: prompt },
    ]);
    return c.json({ data: result });
  });

  app.post("/generate", async (c) => {
    const { description, language, context } = await c.req.json<{ description: string; language?: string; context?: string }>();
    const prompt = `Genere du code ${language ?? ""} pour : ${description}${context ? `\n\nContexte du projet :\n${context}` : ""}\n\nRetourne le code dans un bloc \`\`\`${language ?? ""}\`\`\`.`;

    const result = await llmService.chat([
      { role: "system", content: "Tu es un generateur de code expert. Ecris du code propre, bien structure, avec des noms de variables clairs. Reponds en francais pour les commentaires." },
      { role: "user", content: prompt },
    ]);
    return c.json({ data: result });
  });

  app.post("/fix", async (c) => {
    const { code, language, error } = await c.req.json<{ code: string; language?: string; error?: string }>();
    const prompt = `Ce code ${language ?? ""} a un probleme${error ? ` : "${error}"` : ""}. Corrige-le et explique le bug.\n\nCode:\n\`\`\`${language ?? ""}\n${code}\n\`\`\`\n\nRetourne le code corrige dans un bloc \`\`\`${language ?? ""}\`\`\` suivi de l'explication du bug.`;

    const result = await llmService.chat([
      { role: "system", content: "Tu es un expert en debugging. Identifie et corrige les bugs. Reponds en francais." },
      { role: "user", content: prompt },
    ]);
    return c.json({ data: result });
  });

  app.post("/tests", async (c) => {
    const { code, language, framework } = await c.req.json<{ code: string; language?: string; framework?: string }>();
    const prompt = `Genere des tests unitaires pour ce code ${language ?? ""}${framework ? ` avec ${framework}` : ""}.\n\nCode:\n\`\`\`${language ?? ""}\n${code}\n\`\`\`\n\nRetourne les tests dans un bloc \`\`\`${language ?? ""}\`\`\`.`;

    const result = await llmService.chat([
      { role: "system", content: "Tu es un expert en tests. Ecris des tests clairs, couvrant les cas normaux et les cas limites. Reponds en francais pour les descriptions." },
      { role: "user", content: prompt },
    ]);
    return c.json({ data: result });
  });

  app.post("/document", async (c) => {
    const { code, language } = await c.req.json<{ code: string; language?: string }>();
    const prompt = `Ajoute une documentation complete a ce code ${language ?? ""} (JSDoc/docstrings selon le langage). Retourne le code documente dans un bloc \`\`\`${language ?? ""}\`\`\`.\n\nCode:\n\`\`\`${language ?? ""}\n${code}\n\`\`\``;

    const result = await llmService.chat([
      { role: "system", content: "Tu es un expert en documentation de code. Ecris des docstrings claires et utiles. Les descriptions en francais." },
      { role: "user", content: prompt },
    ]);
    return c.json({ data: result });
  });

  return app;
}
