import type { LlmService } from "../llm/llm.service";
import type { ChatRepository } from "../../domain/chat/chat.repository";
import type { ChatMessage } from "../../domain/chat/chat.entity";
import type { AgentMemoryRepository } from "../../domain/agent-memory/agent-memory.repository";
import { ToolRegistry } from "./tool-registry";

interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface ToolResult {
  tool: string;
  result: unknown;
  error?: string;
}

export interface AgentResponse {
  message: ChatMessage;
  toolCalls: ToolResult[];
}

const MAX_TOOL_ROUNDS = 5;

export class AgentService {
  constructor(
    private chatRepo: ChatRepository,
    private llmService: LlmService | null,
    private toolRegistry: ToolRegistry,
    private memoryRepo?: AgentMemoryRepository,
  ) {}

  async listConversations() {
    return this.chatRepo.listConversations();
  }

  async createConversation(title?: string) {
    return this.chatRepo.createConversation(title);
  }

  async getMessages(conversationId: string) {
    return this.chatRepo.getMessages(conversationId);
  }

  async deleteConversation(id: string) {
    return this.chatRepo.deleteConversation(id);
  }

  async sendMessage(conversationId: string, content: string): Promise<AgentResponse> {
    if (!this.llmService) throw new Error("No LLM configured");

    // Save user message
    await this.chatRepo.addMessage(conversationId, "user", content);

    // Get conversation history
    const messages = await this.chatRepo.getMessages(conversationId);

    // Build the system prompt with tool descriptions + memories
    const systemPrompt = await this.buildSystemPromptAsync();

    // Tool-calling loop
    const allToolResults: ToolResult[] = [];
    let currentMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llmService.chat(currentMessages);

      // Try to parse tool calls from the response
      const toolCalls = this.parseToolCalls(response);

      if (toolCalls.length === 0) {
        // No tool calls — this is the final answer
        const assistantMsg = await this.chatRepo.addMessage(conversationId, "assistant", response);
        await this.autoTitle(conversationId, content, messages.length);
        return { message: assistantMsg, toolCalls: allToolResults };
      }

      // Execute tool calls
      const results: ToolResult[] = [];
      for (const tc of toolCalls) {
        const tool = this.toolRegistry.get(tc.tool);
        if (!tool) {
          results.push({ tool: tc.tool, result: null, error: `Outil inconnu: ${tc.tool}` });
          continue;
        }
        try {
          const result = await tool.execute(tc.params);
          results.push({ tool: tc.tool, result });
        } catch (e) {
          results.push({ tool: tc.tool, result: null, error: String(e) });
        }
      }

      allToolResults.push(...results);

      // Add the assistant response and tool results to the conversation for the next round
      const toolResultsText = results.map((r) => {
        if (r.error) return `[ERREUR ${r.tool}]: ${r.error}`;
        return `[RESULTAT ${r.tool}]: ${JSON.stringify(r.result)}`;
      }).join("\n\n");

      currentMessages.push(
        { role: "assistant" as const, content: response },
        { role: "user" as const, content: `Voici les resultats des outils que tu as appeles :\n\n${toolResultsText}\n\nMaintenant, reponds a l'utilisateur en utilisant ces resultats. Si tu as besoin d'appeler d'autres outils, utilise le meme format TOOL_CALL. Sinon, reponds normalement.` },
      );
    }

    // Max rounds reached — ask LLM for final answer
    currentMessages.push({
      role: "user" as const,
      content: "Tu as atteint la limite d'appels d'outils. Reponds maintenant avec les informations que tu as. Ne fais plus d'appels d'outils.",
    });

    const finalResponse = await this.llmService.chat(currentMessages);
    const cleanResponse = this.stripToolCalls(finalResponse);
    const assistantMsg = await this.chatRepo.addMessage(conversationId, "assistant", cleanResponse);
    await this.autoTitle(conversationId, content, messages.length);
    return { message: assistantMsg, toolCalls: allToolResults };
  }

  async *sendMessageStream(conversationId: string, content: string): AsyncGenerator<{ type: "tool" | "chunk" | "done"; data: string }> {
    if (!this.llmService) throw new Error("No LLM configured");

    await this.chatRepo.addMessage(conversationId, "user", content);
    const messages = await this.chatRepo.getMessages(conversationId);
    const systemPrompt = await this.buildSystemPromptAsync();

    const allToolResults: ToolResult[] = [];
    let currentMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Tool-calling rounds (non-streaming)
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llmService.chat(currentMessages);
      const toolCalls = this.parseToolCalls(response);

      if (toolCalls.length === 0) {
        // No tools — stream the final response from scratch
        let fullText = "";
        const streamMessages = [...currentMessages];
        for await (const chunk of this.llmService.chatStream(streamMessages)) {
          fullText += chunk;
          yield { type: "chunk", data: chunk };
        }
        await this.chatRepo.addMessage(conversationId, "assistant", fullText);
        await this.autoTitle(conversationId, content, messages.length);
        yield { type: "done", data: fullText };
        return;
      }

      // Execute tools
      const results: ToolResult[] = [];
      for (const tc of toolCalls) {
        const tool = this.toolRegistry.get(tc.tool);
        if (!tool) {
          results.push({ tool: tc.tool, result: null, error: `Outil inconnu: ${tc.tool}` });
          continue;
        }
        try {
          const result = await tool.execute(tc.params);
          results.push({ tool: tc.tool, result });
        } catch (e) {
          results.push({ tool: tc.tool, result: null, error: String(e) });
        }
      }

      allToolResults.push(...results);
      yield { type: "tool", data: JSON.stringify(results) };

      const toolResultsText = results.map((r) => {
        if (r.error) return `[ERREUR ${r.tool}]: ${r.error}`;
        return `[RESULTAT ${r.tool}]: ${JSON.stringify(r.result)}`;
      }).join("\n\n");

      currentMessages.push(
        { role: "assistant" as const, content: response },
        { role: "user" as const, content: `Voici les resultats des outils que tu as appeles :\n\n${toolResultsText}\n\nMaintenant, reponds a l'utilisateur en utilisant ces resultats. Si tu as besoin d'appeler d'autres outils, utilise le meme format TOOL_CALL. Sinon, reponds normalement.` },
      );
    }

    // Max rounds — stream final answer
    currentMessages.push({
      role: "user" as const,
      content: "Tu as atteint la limite d'appels d'outils. Reponds maintenant avec les informations que tu as. Ne fais plus d'appels d'outils.",
    });

    let fullText = "";
    for await (const chunk of this.llmService.chatStream(currentMessages)) {
      const clean = this.stripToolCalls(chunk);
      if (clean) {
        fullText += clean;
        yield { type: "chunk", data: clean };
      }
    }

    await this.chatRepo.addMessage(conversationId, "assistant", fullText);
    await this.autoTitle(conversationId, content, messages.length);
    yield { type: "done", data: fullText };
  }

  private async buildSystemPromptAsync(): Promise<string> {
    const today = new Date().toISOString().split("T")[0];
    const dayName = new Date().toLocaleDateString("fr-FR", { weekday: "long" });
    const toolsDescription = this.toolRegistry.describeForLlm();

    let memorySection = "";
    if (this.memoryRepo) {
      try {
        const memories = await this.memoryRepo.findActive();
        if (memories.length > 0) {
          const grouped = {
            fact: memories.filter((m) => m.type === "fact"),
            preference: memories.filter((m) => m.type === "preference"),
            context: memories.filter((m) => m.type === "context"),
          };
          const parts: string[] = [];
          if (grouped.fact.length > 0) parts.push("**Faits :** " + grouped.fact.map((m) => m.content).join(" | "));
          if (grouped.preference.length > 0) parts.push("**Preferences :** " + grouped.preference.map((m) => m.content).join(" | "));
          if (grouped.context.length > 0) parts.push("**Contexte actuel :** " + grouped.context.map((m) => m.content).join(" | "));
          memorySection = `\n\n## Ce que tu sais de l'utilisateur\n\n${parts.join("\n")}`;
        }
      } catch {
        // Memory unavailable — continue without
      }
    }

    return `Tu es l'assistant Magick Cookie, un assistant de productivite personnel.
Nous sommes le ${dayName} ${today}.${memorySection}

Tu as acces aux outils suivants pour repondre aux questions de l'utilisateur :

${toolsDescription}

## Comment utiliser les outils

Quand tu as besoin de donnees ou d'executer une action, reponds UNIQUEMENT avec un bloc JSON dans ce format exact :

\`\`\`TOOL_CALL
{"tool": "nom_de_loutil", "params": {"param1": "valeur1"}}
\`\`\`

Tu peux appeler plusieurs outils dans une meme reponse :

\`\`\`TOOL_CALL
{"tool": "get_streak", "params": {}}
\`\`\`

\`\`\`TOOL_CALL
{"tool": "get_today_stats", "params": {}}
\`\`\`

## Regles

- Reponds TOUJOURS en francais
- Si une question concerne tes donnees, appelle un outil — ne devine PAS
- Si tu appelles un outil, ne mets RIEN d'autre dans ta reponse que les blocs TOOL_CALL
- Quand tu recois les resultats des outils, formule une reponse claire et concise
- Pour les durees, convertis les secondes en heures/minutes lisibles (ex: 7200s → 2h)
- Sois concis et actionnable, pas de blabla
- Tu peux executer des actions (creer tache, trier, etc.) quand l'utilisateur le demande
- Confirme toujours apres avoir execute une action
- Tu peux sauvegarder des informations sur l'utilisateur avec save_memory. Utilise-le quand l'utilisateur te dit quelque chose sur lui-meme ou ses preferences.`;
  }

  private buildSystemPrompt(): string {
    // Kept for backwards compatibility — sync version without memories
    return this.buildSystemPromptSync();
  }

  private buildSystemPromptSync(): string {
    const today = new Date().toISOString().split("T")[0];
    const dayName = new Date().toLocaleDateString("fr-FR", { weekday: "long" });
    const toolsDescription = this.toolRegistry.describeForLlm();

    return `Tu es l'assistant Magick Cookie, un assistant de productivite personnel.
Nous sommes le ${dayName} ${today}.

Tu as acces aux outils suivants pour repondre aux questions de l'utilisateur :

${toolsDescription}

## Comment utiliser les outils

Quand tu as besoin de donnees ou d'executer une action, reponds UNIQUEMENT avec un bloc JSON dans ce format exact :

\`\`\`TOOL_CALL
{"tool": "nom_de_loutil", "params": {"param1": "valeur1"}}
\`\`\`

Tu peux appeler plusieurs outils dans une meme reponse :

\`\`\`TOOL_CALL
{"tool": "get_streak", "params": {}}
\`\`\`

\`\`\`TOOL_CALL
{"tool": "get_today_stats", "params": {}}
\`\`\`

## Regles

- Reponds TOUJOURS en francais
- Si une question concerne tes donnees, appelle un outil — ne devine PAS
- Si tu appelles un outil, ne mets RIEN d'autre dans ta reponse que les blocs TOOL_CALL
- Quand tu recois les resultats des outils, formule une reponse claire et concise
- Pour les durees, convertis les secondes en heures/minutes lisibles (ex: 7200s → 2h)
- Sois concis et actionnable, pas de blabla
- Tu peux executer des actions (creer tache, trier, etc.) quand l'utilisateur le demande
- Confirme toujours apres avoir execute une action`;
  }

  private parseToolCalls(response: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const regex = /```TOOL_CALL\s*\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.tool && typeof parsed.tool === "string") {
          calls.push({
            tool: parsed.tool,
            params: parsed.params || {},
          });
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return calls;
  }

  private stripToolCalls(response: string): string {
    return response.replace(/```TOOL_CALL\s*\n[\s\S]*?```/g, "").trim();
  }

  private async autoTitle(conversationId: string, userContent: string, previousMessageCount: number) {
    if (previousMessageCount > 2) return;
    const conv = await this.chatRepo.getConversation(conversationId);
    if (!conv || conv.title !== "Nouvelle conversation") return;

    try {
      const titleResponse = await this.llmService!.chat([
        { role: "system", content: "Genere un titre court (max 5 mots) pour cette conversation. Reponds uniquement avec le titre, sans guillemets." },
        { role: "user", content: userContent },
      ]);
      await this.chatRepo.updateConversationTitle(conversationId, titleResponse.trim().substring(0, 100));
    } catch {
      // Ignore title generation errors
    }
  }
}
