const MAX_BODY = 2000;

function truncate(text: string | null | undefined): string {
  if (!text) return "";
  return text.length > MAX_BODY ? text.slice(0, MAX_BODY) + "…" : text;
}

export function buildEmailPrompt(email: {
  from: string;
  subject: string;
  bodyText: string | null;
}): string {
  const body = truncate(email.bodyText);
  return `De : ${email.from}
Sujet : ${email.subject}

${body}

---
Que veux-tu faire avec cet email ?`;
}

export function buildRssPrompt(article: {
  feedLabel: string;
  title: string;
  bodyText: string | null;
  link: string | null;
}): string {
  const parts: string[] = [
    `Source : ${article.feedLabel}`,
    `Titre : ${article.title}`,
  ];
  if (article.link) parts.push(`Lien : ${article.link}`);
  const body = truncate(article.bodyText);
  if (body) parts.push(`\n${body}`);
  parts.push("\n---\nQue veux-tu faire avec cet article ?");
  return parts.join("\n");
}

export function buildSnippetPrompt(snippet: {
  title: string;
  language: string;
  content: string;
}): string {
  return `Snippet : ${snippet.title}

\`\`\`${snippet.language}
${snippet.content}
\`\`\`

Que veux-tu faire avec ce snippet ?`;
}

export function buildTaskPrompt(task: {
  name: string;
  description: string | null;
  priority: string | null;
}): string {
  const parts: string[] = [`Tâche : ${task.name}`];
  if (task.priority) parts.push(`Priorité : ${task.priority}`);
  if (task.description) parts.push(`\n${task.description}`);
  parts.push("\n---\nQue veux-tu faire avec cette tâche ?");
  return parts.join("\n");
}

export function buildFluxTriagePrompt(): string {
  return "Je voudrais trier ma boîte de réception. Peux-tu m'aider à classer, archiver ou résumer les éléments en attente ?";
}
