export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: AgentTool[]) {
    for (const tool of tools) this.register(tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  all(): AgentTool[] {
    return [...this.tools.values()];
  }

  /** Build a description of all tools for the LLM system prompt */
  describeForLlm(): string {
    const tools = this.all();
    if (tools.length === 0) return "";

    const lines = tools.map((t) => {
      const params = Object.entries(t.parameters);
      const paramStr = params.length > 0
        ? params.map(([k, v]) => `    - ${k} (${v.type}${v.required === false ? ", optionnel" : ""}): ${v.description}`).join("\n")
        : "    (aucun parametre)";
      return `- **${t.name}**: ${t.description}\n  Parametres:\n${paramStr}`;
    });

    return lines.join("\n\n");
  }
}
