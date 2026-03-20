import type { LlmConfigRepository } from "../../domain/llm/llm-config.repository";
import type { LlmConfig, CreateLlmConfigInput } from "../../domain/llm/llm-config.entity";
import type { LlmPort, LlmMessage } from "../../domain/llm/llm.port";
import { OllamaAdapter } from "../../infrastructure/adapters/ollama.adapter";
import { OpenAICompatibleAdapter } from "../../infrastructure/adapters/openai-compatible.adapter";
import { AnthropicAdapter } from "../../infrastructure/adapters/anthropic.adapter";

export class LlmService {
  constructor(private configRepo: LlmConfigRepository) {}

  async getConfig(): Promise<LlmConfig | null> {
    return this.configRepo.getActive();
  }

  async updateConfig(input: CreateLlmConfigInput): Promise<LlmConfig> {
    return this.configRepo.upsert(input);
  }

  async chat(messages: LlmMessage[]): Promise<string> {
    const config = await this.configRepo.getActive();
    if (!config) throw new Error("No LLM configured");

    const adapter = this.createAdapter(config);
    return adapter.chat(messages, config.model);
  }

  async *chatStream(messages: LlmMessage[]): AsyncIterable<string> {
    const config = await this.configRepo.getActive();
    if (!config) throw new Error("No LLM configured");

    const adapter = this.createAdapter(config);
    yield* adapter.chatStream(messages, config.model);
  }

  async summarize(text: string, systemPrompt: string): Promise<string> {
    return this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ]);
  }

  async classify(text: string, categories: string[]): Promise<string> {
    const catList = categories.join(", ");
    const response = await this.chat([
      {
        role: "system",
        content: `Tu es un classificateur d'emails. Tu dois classer le texte dans EXACTEMENT UNE de ces categories : ${catList}. Reponds UNIQUEMENT avec le nom de la categorie, rien d'autre. Pas d'explication, pas de ponctuation, juste le mot de la categorie.`,
      },
      { role: "user", content: text },
    ]);
    const normalized = response.trim().toLowerCase();
    return categories.includes(normalized) ? normalized : "autre";
  }

  async generateNarrative(data: string, systemPrompt: string): Promise<string> {
    return this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: data },
    ]);
  }

  async generateEvents(prompt: string, date: string): Promise<{ title: string; startAt: string; endAt: string; description: string | null; location: string | null; isAllDay: boolean }[]> {
    const systemPrompt = `Tu es un assistant de planification. L'utilisateur te donne une description de sa journee ou de ses evenements.
Tu dois generer une liste d'evenements au format JSON strict.

La date de reference est : ${date}

Reponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication. Le format attendu :
{
  "events": [
    {
      "title": "Titre de l'evenement",
      "startAt": "2026-03-19T09:00:00.000Z",
      "endAt": "2026-03-19T10:00:00.000Z",
      "description": "Description optionnelle ou null",
      "location": "Lieu optionnel ou null",
      "isAllDay": false
    }
  ]
}

Regles :
- Les dates doivent etre en ISO 8601
- Utilise la date de reference fournie
- Genere des horaires realistes
- Le titre doit etre court et descriptif`;

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ]);

    try {
      const parsed = JSON.parse(response.trim());
      const events = parsed.events ?? parsed;
      if (!Array.isArray(events)) return [];
      return events.map((e: any) => ({
        title: String(e.title ?? ""),
        startAt: String(e.startAt ?? ""),
        endAt: String(e.endAt ?? ""),
        description: e.description ?? null,
        location: e.location ?? null,
        isAllDay: Boolean(e.isAllDay),
      }));
    } catch {
      return [];
    }
  }

  async generateRssDigest(articles: { feedLabel: string; title: string; description: string | null; link: string | null; publishedAt: string | null }[]): Promise<{
    highlights: { title: string; feedLabel: string; reason: string; link: string | null }[];
    summary: string;
    categories: { name: string; count: number; topArticle: string }[];
  }> {
    const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const systemPrompt = `Tu es un assistant de veille qui trie et resume les flux RSS de l'utilisateur.
Date du jour : ${today}

Tu recois une liste d'articles RSS recents (non lus). Tu dois :
1. Identifier les 5-10 articles les plus interessants / importants (highlights)
2. Ecrire un resume global de 2-3 phrases sur les tendances du jour
3. Grouper par thematique avec un comptage

Reponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication :
{
  "highlights": [
    { "title": "Titre exact de l'article", "feedLabel": "Nom du feed", "reason": "Pourquoi c'est interessant (1 phrase)", "link": "url ou null" }
  ],
  "summary": "Resume global des tendances du jour en 2-3 phrases.",
  "categories": [
    { "name": "Nom de la thematique", "count": 3, "topArticle": "Titre du meilleur article de cette categorie" }
  ]
}

Regles :
- Priorise les articles recents et a forte valeur informationnelle
- Ignore les articles publicitaires, repetitifs ou a faible interet
- Les raisons doivent etre courtes et concretes
- Regroupe intelligemment par thematique (tech, business, science, culture, etc.)
- Garde les titres exacts des articles`;

    const articlesText = articles.map((a, i) =>
      `[${i + 1}] Feed: ${a.feedLabel} | Titre: ${a.title} | Date: ${a.publishedAt ?? "?"} | Desc: ${(a.description ?? "").slice(0, 200)}${a.link ? ` | Lien: ${a.link}` : ""}`
    ).join("\n");

    const response = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: articlesText },
    ]);

    try {
      const parsed = JSON.parse(response.trim());
      return {
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map((h: any) => ({
          title: String(h.title ?? ""),
          feedLabel: String(h.feedLabel ?? ""),
          reason: String(h.reason ?? ""),
          link: h.link ?? null,
        })) : [],
        summary: String(parsed.summary ?? ""),
        categories: Array.isArray(parsed.categories) ? parsed.categories.map((c: any) => ({
          name: String(c.name ?? ""),
          count: Number(c.count ?? 0),
          topArticle: String(c.topArticle ?? ""),
        })) : [],
      };
    } catch {
      return { highlights: [], summary: "", categories: [] };
    }
  }

  async testConnection(): Promise<boolean> {
    const config = await this.configRepo.getActive();
    if (!config) return false;

    const adapter = this.createAdapter(config);
    return adapter.testConnection(config.model);
  }

  private createAdapter(config: LlmConfig): LlmPort {
    switch (config.provider) {
      case "anthropic":
        if (!config.apiKey) throw new Error("Anthropic API key required");
        return new AnthropicAdapter(config.apiKey, config.baseUrl, config.maxTokens);
      case "lmstudio":
      case "openai-compatible":
        return new OpenAICompatibleAdapter(config.baseUrl, config.apiKey);
      case "ollama":
      default:
        return new OllamaAdapter(config.baseUrl);
    }
  }
}
