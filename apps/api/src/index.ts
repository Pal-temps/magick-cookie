import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { db } from "./infrastructure/database/client";
import { errorHandler } from "./presentation/middleware/error-handler";
import { authMiddleware } from "./presentation/middleware/auth";

// Repositories
import { DrizzleCalendarRepository } from "./infrastructure/repositories/calendar.repository.impl";
import { DrizzleEventRepository } from "./infrastructure/repositories/event.repository.impl";
import { DrizzleReminderRepository } from "./infrastructure/repositories/reminder.repository.impl";
import { DrizzleContactRepository } from "./infrastructure/repositories/contact.repository.impl";
import { DrizzleTaskRepository } from "./infrastructure/repositories/task.repository.impl";
import { DrizzleTimerSessionRepository } from "./infrastructure/repositories/timer-session.repository.impl";
import { DrizzleWellnessConfigRepository } from "./infrastructure/repositories/wellness-config.repository.impl";
import { DrizzleWellnessLogRepository } from "./infrastructure/repositories/wellness-log.repository.impl";
import { DrizzleDogWalkRepository } from "./infrastructure/repositories/dog-walk.repository.impl";
import { DrizzleFluxRepository } from "./infrastructure/repositories/flux.repository.impl";
import { DrizzleEmailAccountRepository } from "./infrastructure/repositories/email-account.repository.impl";
import { DrizzleEmailRepository } from "./infrastructure/repositories/email.repository.impl";
import { DrizzleLlmConfigRepository } from "./infrastructure/repositories/llm-config.repository.impl";
import { DrizzleChatRepository } from "./infrastructure/repositories/chat.repository.impl";
import { DrizzleBookmarkRepository } from "./infrastructure/repositories/bookmark.repository.impl";
import { DrizzleBookmarkCategoryRepository } from "./infrastructure/repositories/bookmark-category.repository.impl";
import { DrizzleProjectRepository } from "./infrastructure/repositories/project.repository.impl";
import { DrizzlePushNotificationRepository } from "./infrastructure/repositories/push-notification.repository.impl";
import { DrizzleAgentMemoryRepository } from "./infrastructure/repositories/agent-memory.repository.impl";
import { DrizzleGitHubPRRepository } from "./infrastructure/repositories/github-pr.repository.impl";
import { DrizzleAlarmRepository } from "./infrastructure/repositories/alarm.repository.impl";
import { DrizzleRssFeedRepository } from "./infrastructure/repositories/rss-feed.repository.impl";
import { DrizzleRssArticleRepository } from "./infrastructure/repositories/rss-article.repository.impl";
import { DrizzleSnippetRepository } from "./infrastructure/repositories/snippet.repository.impl";
import { DrizzleCalDavAccountRepository } from "./infrastructure/repositories/caldav-account.repository.impl";
import { DrizzleEmailRuleRepository } from "./infrastructure/repositories/email-rule.repository.impl";
import { DrizzleRoutineRepository } from "./infrastructure/repositories/routine.repository.impl";
import { DrizzleWebhookRepository } from "./infrastructure/repositories/webhook.repository.impl";
import { DrizzleUserPreferencesRepository } from "./infrastructure/repositories/user-preferences.repository.impl";

// Services
import { CalendarService } from "./application/calendar/calendar.service";
import { EventService } from "./application/event/event.service";
import { ReminderService } from "./application/reminder/reminder.service";
import { ContactService } from "./application/contact/contact.service";
import { TaskService } from "./application/task/task.service";
import { TaskDetailService } from "./application/task/task-detail.service";
import { ClickUpSyncService } from "./application/connector/clickup-sync.service";
import { TimerSessionService } from "./application/timer-session/timer-session.service";
import { WellnessConfigService } from "./application/wellness-config/wellness-config.service";
import { WellnessLogService } from "./application/wellness-log/wellness-log.service";
import { DogWalkService } from "./application/dog-walk/dog-walk.service";
import { FluxService } from "./application/flux/flux.service";
import { EmailService } from "./application/email/email.service";
import { AnalyticsService } from "./application/analytics/analytics.service";
import { LlmService } from "./application/llm/llm.service";
import { LlmBudgetService } from "./application/llm/llm-budget.service";
import { BriefService } from "./application/brief/brief.service";
import { GitScanService } from "./application/git/git-scan.service";
import { GitHubService } from "./application/github/github.service";
import { VpsProxyService } from "./application/vps/vps-proxy.service";
import { BookmarkService } from "./application/bookmark/bookmark.service";
import { ProjectService } from "./application/project/project.service";
import { SmartReminderService } from "./application/smart-reminder/smart-reminder.service";
import { AlarmService } from "./application/alarm/alarm.service";
import { RssService } from "./application/rss/rss.service";
import { SnippetService } from "./application/snippet/snippet.service";
import { ChangelogService } from "./application/changelog/changelog.service";
import { CalDavService } from "./application/caldav/caldav.service";
import { EmailRuleService } from "./application/email/email-rule.service";
import { RoutineService } from "./application/routine/routine.service";
import { WebhookService } from "./application/webhook/webhook.service";
import { UserPreferencesService } from "./application/user-preferences/user-preferences.service";
import { AgentService } from "./application/agent/agent.service";
import { ToolRegistry } from "./application/agent/tool-registry";
import { AiToolCallService } from "./application/ai-tool-call/ai-tool-call.service";
import { DrizzleAiToolCallRepository } from "./infrastructure/repositories/ai-tool-call.repository.impl";
import { createAnalyticsTools } from "./application/agent/tools/analytics.tools";
import { createTaskTools } from "./application/agent/tools/task.tools";
import { createTimerTools } from "./application/agent/tools/timer.tools";
import { createBriefTools, createEmailTools, createProjectTools } from "./application/agent/tools/brief.tools";
import { createBookmarkTools } from "./application/agent/tools/bookmark.tools";
import { createCalendarTools } from "./application/agent/tools/calendar.tools";
import { createEmailActionTools } from "./application/agent/tools/email-actions.tools";
import { createRssTools } from "./application/agent/tools/rss.tools";
import { createSnippetTools } from "./application/agent/tools/snippet.tools";
import { createContactTools } from "./application/agent/tools/contact.tools";
import { createAlarmTools } from "./application/agent/tools/alarm.tools";
import { createRoutineTools } from "./application/agent/tools/routine.tools";
import { ProviderService } from "./application/provider/provider.service";
import { createGitHubTools } from "./application/agent/tools/github.tools";
import { createGitLabTools } from "./application/agent/tools/gitlab.tools";
import { createClickUpTools } from "./application/agent/tools/clickup.tools";
import { createMemoryTools } from "./application/agent/tools/memory.tools";
import { createDnsTools } from "./application/agent/tools/dns.tools";
import { createSshTools } from "./application/agent/tools/ssh.tools";
import { createDeployTools } from "./application/agent/tools/deploy.tools";
import { createSkillTools } from "./application/agent/tools/skill.tools";
import { createNotesTools } from "./application/agent/tools/notes.tools";
import { createGhCliTools } from "./application/agent/tools/gh.tools";
import { FsVaultNoteRepository } from "./infrastructure/repositories/vault-note.repository.impl";
import { VaultNoteService } from "./application/vault-note/vault-note.service";
import { createVaultNoteRoutes } from "./presentation/routes/vault-note.routes";
import { DnsService } from "./infrastructure/dns/dns.service";
import { SshService } from "./infrastructure/ssh/ssh.service";
import { DeployService } from "./application/deploy/deploy.service";
import { SkillService } from "./application/skills/skill.service";
import { createGitRemoteTools } from "./application/agent/tools/git-remote.tools";
import { GitRemoteService } from "./infrastructure/git-remote/git-remote.service";
import { VaultService } from "./infrastructure/vault/vault.service";
import { SnapshotService } from "./application/snapshot/snapshot.service";
import { createInfraRoutes } from "./presentation/routes/infra.routes";

// Adapters
import { GitExecAdapter } from "./infrastructure/adapters/git-exec.adapter";

// Connectors
import { ImapConnector } from "./infrastructure/connectors/imap.connector";
import { SmtpConnector } from "./infrastructure/connectors/smtp.connector";
import { CalDavConnector } from "./infrastructure/connectors/caldav.connector";

// Connector configs
import { DrizzleConnectorConfigRepository } from "./infrastructure/repositories/connector-config.repository.impl";
import { ConnectorConfigService } from "./application/connector-config/connector-config.service";
import { GitHubSyncService } from "./application/connector/github-sync.service";
import { GitLabSyncService } from "./application/connector/gitlab-sync.service";
import { createConnectorConfigRoutes } from "./presentation/routes/connector-config.routes";
import { startGitHubIssueSyncJob } from "./infrastructure/jobs/github-issue-sync.job";
import { startGitLabSyncJob } from "./infrastructure/jobs/gitlab-sync.job";

// SSE
import { InMemoryReminderEmitter } from "./infrastructure/sse/reminder-emitter.impl";

// Routes
import { createCalendarRoutes } from "./presentation/routes/calendar.routes";
import { createEventRoutes, createCalendarEventRoutes } from "./presentation/routes/event.routes";
import { createReminderRoutes, createEventReminderRoutes } from "./presentation/routes/reminder.routes";
import { createSSERoutes } from "./presentation/routes/sse.routes";
import { createContactRoutes } from "./presentation/routes/contact.routes";
import { createConnectorRoutes } from "./presentation/routes/connector.routes";
import { createTaskRoutes } from "./presentation/routes/task.routes";
import { createTimerSessionRoutes } from "./presentation/routes/timer-session.routes";
import { createWellnessConfigRoutes } from "./presentation/routes/wellness-config.routes";
import { createWellnessLogRoutes } from "./presentation/routes/wellness-log.routes";
import { createDogWalkRoutes } from "./presentation/routes/dog-walk.routes";
import { createFluxRoutes } from "./presentation/routes/flux.routes";
import { BenchService } from "./application/bench/bench.service";
import { createBenchRoutes } from "./presentation/routes/bench.routes";
import { createEmailRoutes, createEmailAccountRoutes } from "./presentation/routes/email.routes";
import { createAnalyticsRoutes } from "./presentation/routes/analytics.routes";
import { createLlmRoutes } from "./presentation/routes/llm.routes";
import { createBriefRoutes } from "./presentation/routes/brief.routes";
import { createGitHubRoutes } from "./presentation/routes/github.routes";
import { createVpsRoutes } from "./presentation/routes/vps.routes";
import { createRelayRoutes } from "./presentation/routes/relay.routes";
import { createBookmarkRoutes } from "./presentation/routes/bookmark.routes";
import { createProjectRoutes } from "./presentation/routes/project.routes";
import { createSmartReminderRoutes } from "./presentation/routes/smart-reminder.routes";
import { createAgentRoutes } from "./presentation/routes/agent.routes";
import { createAiToolCallRoutes } from "./presentation/routes/ai-tool-call.routes";
import { createAiPermissionsRoutes } from "./presentation/routes/ai-permissions.routes";
import { createPushRoutes } from "./presentation/routes/push.routes";
import { createAlarmRoutes } from "./presentation/routes/alarm.routes";
import { createRssFeedRoutes, createRssArticleRoutes } from "./presentation/routes/rss.routes";
import { createSnippetRoutes } from "./presentation/routes/snippet.routes";
import { createChangelogRoutes } from "./presentation/routes/changelog.routes";
import { createCalDavAccountRoutes } from "./presentation/routes/caldav.routes";
import { createEmailRuleRoutes } from "./presentation/routes/email-rule.routes";
import { createRoutineRoutes } from "./presentation/routes/routine.routes";
import { createWebhookRoutes } from "./presentation/routes/webhook.routes";
import { createUserPreferencesRoutes } from "./presentation/routes/user-preferences.routes";

// Jobs
import { startReminderChecker } from "./infrastructure/jobs/reminder-checker";
import { startEmailSyncJob } from "./infrastructure/jobs/email-sync.job";
import { startGitHubSyncJob } from "./infrastructure/jobs/github-sync.job";
import { startAgentScheduler } from "./infrastructure/jobs/agent-scheduler";
import { startRssSyncJob } from "./infrastructure/jobs/rss-sync.job";
import { startCalDavSyncJob } from "./infrastructure/jobs/caldav-sync.job";

// --- DI ---
const calendarRepo = new DrizzleCalendarRepository(db);
const eventRepo = new DrizzleEventRepository(db);
const reminderRepo = new DrizzleReminderRepository(db);
const contactRepo = new DrizzleContactRepository(db);
const taskRepo = new DrizzleTaskRepository(db);
const timerSessionRepo = new DrizzleTimerSessionRepository(db);
const wellnessConfigRepo = new DrizzleWellnessConfigRepository(db);
const wellnessLogRepo = new DrizzleWellnessLogRepository(db);
const dogWalkRepo = new DrizzleDogWalkRepository(db);
const fluxRepo = new DrizzleFluxRepository(db);
const emailAccountRepo = new DrizzleEmailAccountRepository(db);
const emailRepo = new DrizzleEmailRepository(db);
const llmConfigRepo = new DrizzleLlmConfigRepository(db);
const chatRepo = new DrizzleChatRepository(db);
const bookmarkRepo = new DrizzleBookmarkRepository(db);
const bookmarkCategoryRepo = new DrizzleBookmarkCategoryRepository(db);
const projectRepo = new DrizzleProjectRepository(db);
const pushRepo = new DrizzlePushNotificationRepository(db);
const agentMemoryRepo = new DrizzleAgentMemoryRepository(db);
const githubPrRepo = new DrizzleGitHubPRRepository(db);
const alarmRepo = new DrizzleAlarmRepository(db);
const rssFeedRepo = new DrizzleRssFeedRepository(db);
const rssArticleRepo = new DrizzleRssArticleRepository(db);
const snippetRepo = new DrizzleSnippetRepository(db);
const caldavAccountRepo = new DrizzleCalDavAccountRepository(db);
const emailRuleRepo = new DrizzleEmailRuleRepository(db);
const routineRepo = new DrizzleRoutineRepository(db);
const webhookRepo = new DrizzleWebhookRepository(db);
const userPreferencesRepo = new DrizzleUserPreferencesRepository(db);
const connectorConfigRepo = new DrizzleConnectorConfigRepository(db);
const aiToolCallRepo = new DrizzleAiToolCallRepository(db);

const calendarService = new CalendarService(calendarRepo);
const eventService = new EventService(eventRepo, reminderRepo);
const reminderService = new ReminderService(reminderRepo, eventRepo);
const contactService = new ContactService(contactRepo);
const taskService = new TaskService(taskRepo);
const taskDetailService = new TaskDetailService(taskService, connectorConfigRepo);
const timerSessionService = new TimerSessionService(timerSessionRepo);
const wellnessConfigService = new WellnessConfigService(wellnessConfigRepo);
const wellnessLogService = new WellnessLogService(wellnessLogRepo);
const dogWalkService = new DogWalkService(dogWalkRepo);
const imapConnector = new ImapConnector();
const smtpConnector = new SmtpConnector();
const emailService = new EmailService(emailAccountRepo, emailRepo, imapConnector, smtpConnector);
const analyticsService = new AnalyticsService(timerSessionRepo, dogWalkRepo, wellnessLogRepo, fluxRepo, emailRepo, eventRepo, taskRepo, projectRepo);
const llmBudgetService = new LlmBudgetService(userPreferencesRepo);
const llmService = new LlmService(llmConfigRepo, llmBudgetService);
const fluxService = new FluxService(fluxRepo, taskRepo, llmService, emailRepo, rssArticleRepo, rssFeedRepo);
const gitRepoPaths = process.env.GIT_SCAN_REPOS?.split(",").map((p) => p.trim()).filter(Boolean) || [];
const gitExecAdapter = new GitExecAdapter();
const gitScanService = gitRepoPaths.length > 0 ? new GitScanService(gitRepoPaths, gitExecAdapter) : undefined;
const briefService = new BriefService(timerSessionRepo, eventRepo, taskRepo, fluxRepo, emailRepo, llmService, gitScanService);
const githubService = new GitHubService(connectorConfigRepo, githubPrRepo);
const vpsProxyService = new VpsProxyService(config.vpsApiUrl, config.vpsApiToken);
const bookmarkService = new BookmarkService(bookmarkRepo, bookmarkCategoryRepo);
const projectService = new ProjectService(projectRepo);
const smartReminderService = new SmartReminderService(fluxRepo, taskRepo, emailRepo);
const alarmService = new AlarmService(alarmRepo);
const rssService = new RssService(rssFeedRepo, rssArticleRepo);
rssService.setLlmService(llmService);
const snippetService = new SnippetService(snippetRepo);
const changelogService = new ChangelogService(gitScanService, llmService);
const caldavConnector = new CalDavConnector();
const caldavService = new CalDavService(caldavAccountRepo, caldavConnector, eventRepo);
const emailRuleService = new EmailRuleService(emailRuleRepo);
emailService.setEmailRuleService(emailRuleService);
const routineService = new RoutineService(routineRepo);
const webhookService = new WebhookService(webhookRepo);
const userPreferencesService = new UserPreferencesService(userPreferencesRepo);

// Agent (tool-calling chat)
const aiToolCallService = new AiToolCallService(aiToolCallRepo);
const toolRegistry = new ToolRegistry(aiToolCallService);
toolRegistry.registerAll(createAnalyticsTools(analyticsService));
toolRegistry.registerAll(createTaskTools(taskService, fluxService));
toolRegistry.registerAll(createTimerTools(timerSessionService));
toolRegistry.registerAll(createBriefTools(briefService));
toolRegistry.registerAll(createEmailTools(emailService, llmService));
toolRegistry.registerAll(createEmailActionTools(emailService));
toolRegistry.registerAll(createRssTools(rssService));
toolRegistry.registerAll(createSnippetTools(snippetService));
toolRegistry.registerAll(createContactTools(contactService));
toolRegistry.registerAll(createAlarmTools(alarmService));
toolRegistry.registerAll(createRoutineTools(routineService));
const providerService = new ProviderService(connectorConfigRepo);
toolRegistry.registerAll(createGitHubTools(providerService));
toolRegistry.registerAll(createGitLabTools(providerService));
toolRegistry.registerAll(createClickUpTools(providerService));
toolRegistry.registerAll(createGhCliTools(providerService));
toolRegistry.registerAll(createCalendarTools(eventService, calendarService, llmService));
toolRegistry.registerAll(createBookmarkTools(bookmarkService));
toolRegistry.registerAll(createProjectTools(projectService));
toolRegistry.registerAll(createMemoryTools(agentMemoryRepo));

// Infrastructure tools (DNS, SSH, Deploy, Skills)
const vaultService = new VaultService();
const dnsService = new DnsService();
const sshService = new SshService(vaultService);
const gitRemoteService = new GitRemoteService(sshService);
const deployService = new DeployService(dnsService, sshService, gitRemoteService);
const skillService = new SkillService(vaultService);
const snapshotService = new SnapshotService(vaultService, taskRepo, eventRepo, contactRepo, bookmarkRepo);
toolRegistry.registerAll(createDnsTools(dnsService));
toolRegistry.registerAll(createSshTools(sshService));
toolRegistry.registerAll(createDeployTools(sshService));
toolRegistry.registerAll(createGitRemoteTools(gitRemoteService));
toolRegistry.registerAll(createSkillTools(skillService));
const vaultNoteRepo = new FsVaultNoteRepository(vaultService);
const vaultNoteService = new VaultNoteService(vaultNoteRepo);
toolRegistry.registerAll(createNotesTools(vaultNoteService));
const agentService = new AgentService(chatRepo, llmService, toolRegistry, agentMemoryRepo, providerService);

const clickUpSyncService = new ClickUpSyncService(connectorConfigRepo, calendarService, eventRepo, taskRepo);
const connectorConfigService = new ConnectorConfigService(connectorConfigRepo);
const githubSyncService = new GitHubSyncService(connectorConfigRepo, calendarService, eventRepo, taskRepo);
const gitlabSyncService = new GitLabSyncService(connectorConfigRepo, calendarService, eventRepo, taskRepo);

const reminderEmitter = new InMemoryReminderEmitter();

// --- App ---
const app = new Hono();

app.use(
  "/*",
  cors({
    origin: (origin) => {
      // No Origin header → same-origin / native fetch → allow (local Tauri, curl, tests)
      if (!origin) return origin ?? "*";
      return config.corsOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Webhook-Secret"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use("/api/*", authMiddleware);
app.onError(errorHandler);

// Health
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/calendars", createCalendarRoutes(calendarService));
app.route("/api/events", createEventRoutes(eventService));
app.route("/api/calendars/:calendarId/events", createCalendarEventRoutes(eventService));
app.route("/api/reminders", createReminderRoutes(reminderService));
app.route("/api/events/:eventId/reminders", createEventReminderRoutes(reminderService));
app.route("/api/sse", createSSERoutes(reminderEmitter));
app.route("/api/contacts", createContactRoutes(contactService));
app.route("/api/connectors", createConnectorRoutes({ clickup: clickUpSyncService, github: githubSyncService, gitlab: gitlabSyncService }));
app.route("/api/tasks", createTaskRoutes(taskService, taskDetailService));
app.route("/api/connector-configs", createConnectorConfigRoutes(connectorConfigService));
app.route("/api/timer-sessions", createTimerSessionRoutes(timerSessionService));
app.route("/api/wellness-configs", createWellnessConfigRoutes(wellnessConfigService));
app.route("/api/wellness-logs", createWellnessLogRoutes(wellnessLogService));
app.route("/api/dog-walks", createDogWalkRoutes(dogWalkService));
app.route("/api/flux", createFluxRoutes(fluxService));
const benchService = new BenchService();
app.route("/api/bench", createBenchRoutes(benchService));
app.route("/api/emails", createEmailRoutes(emailService, llmService));
app.route("/api/email-accounts", createEmailAccountRoutes(emailService));
app.route("/api/analytics", createAnalyticsRoutes(analyticsService, llmService));
app.route("/api/llm", createLlmRoutes(llmService));
app.route("/api/brief", createBriefRoutes(briefService));
app.route("/api/github", createGitHubRoutes(githubService));
app.route("/api/vps", createVpsRoutes(vpsProxyService));
app.route("/api/infra", createInfraRoutes(dnsService, sshService, deployService, skillService, vaultService, snapshotService));
app.route("/api/vault/notes", createVaultNoteRoutes(vaultNoteService));
app.route("/api/bookmarks", createBookmarkRoutes(bookmarkService));
app.route("/api/projects", createProjectRoutes(projectService));
app.route("/api/smart-reminders", createSmartReminderRoutes(smartReminderService));
app.route("/api/agent", createAgentRoutes(agentService));
app.route("/api/ai/tool-calls", createAiToolCallRoutes(aiToolCallService));
app.route("/api/ai/permissions", createAiPermissionsRoutes());
app.get("/api/ai/budget", async (c) => c.json({ data: await llmBudgetService.getUsage() }));

// ── MCP tool bridge — used by the Cookia MCP server ──────────────────────────

// GET /api/ai/tools — list all registered tools in MCP inputSchema format
app.get("/api/ai/tools", (c) => {
  const tools = toolRegistry.all().map((t) => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, param] of Object.entries(t.parameters)) {
      properties[key] = { type: param.type, description: param.description };
      if (param.required !== false) required.push(key);
    }
    return {
      name: t.name,
      description: t.description,
      permissionLevel: t.permissionLevel ?? "auto",
      inputSchema: { type: "object", properties, required },
    };
  });
  return c.json({ data: tools });
});

// POST /api/ai/tools/call — dispatch a tool and return its result
app.post("/api/ai/tools/call", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return c.json({ error: "Missing tool name" }, 400);
  }
  const result = await toolRegistry.dispatch(
    body.name,
    (body.arguments ?? {}) as Record<string, unknown>,
    { sessionId: (body.session_id as string | undefined) ?? "cookia" },
  );
  return c.json(result);
});
app.route("/api/push", createPushRoutes(pushRepo));
app.route("/api/alarms", createAlarmRoutes(alarmService));
app.route("/api/rss-feeds", createRssFeedRoutes(rssService));
app.route("/api/rss-articles", createRssArticleRoutes(rssService));
app.route("/api/snippets", createSnippetRoutes(snippetService));
app.route("/api/changelog", createChangelogRoutes(changelogService));
app.route("/api/caldav-accounts", createCalDavAccountRoutes(caldavService));
app.route("/api/email-rules", createEmailRuleRoutes(emailRuleService));
app.route("/api/routines", createRoutineRoutes(routineService));
app.route("/api/webhooks", createWebhookRoutes(webhookService));
app.route("/api/user-preferences", createUserPreferencesRoutes(userPreferencesService));
app.route("/api/relay", createRelayRoutes());

// --- Jobs ---
const timers: Timer[] = [];

timers.push(startReminderChecker(reminderService, eventRepo, reminderEmitter));

// Conditional jobs — only start if the relevant feature is configured
(async () => {
  try {
    const emailAccounts = await emailAccountRepo.findAll();
    if (emailAccounts.length > 0) {
      timers.push(startEmailSyncJob(emailService));
    } else {
      console.log("[email-sync] Skipped — no email accounts configured");
    }
  } catch (err) {
    console.error("[email-sync] Failed to check config:", err);
  }

  try {
    const ghConfig = await connectorConfigRepo.findByType("github");
    if (ghConfig) {
      timers.push(startGitHubSyncJob(githubService));
    } else {
      console.log("[github-sync] Skipped — no GitHub config");
    }
  } catch (err) {
    console.error("[github-sync] Failed to check config:", err);
  }

  try {
    const ghConnector = await connectorConfigRepo.findByType("github");
    if (ghConnector?.enabled) {
      timers.push(startGitHubIssueSyncJob(githubSyncService));
    } else {
      console.log("[github-issue-sync] Skipped — no GitHub connector configured");
    }
  } catch (err) {
    console.error("[github-issue-sync] Failed to check config:", err);
  }

  try {
    const glConnector = await connectorConfigRepo.findByType("gitlab");
    if (glConnector?.enabled) {
      timers.push(startGitLabSyncJob(gitlabSyncService));
    } else {
      console.log("[gitlab-sync] Skipped — no GitLab connector configured");
    }
  } catch (err) {
    console.error("[gitlab-sync] Failed to check config:", err);
  }

  try {
    const rssFeeds = await rssFeedRepo.findAll();
    if (rssFeeds.length > 0) {
      timers.push(startRssSyncJob(rssService));
    } else {
      console.log("[rss-sync] Skipped — no RSS feeds configured");
    }
  } catch (err) {
    console.error("[rss-sync] Failed to check config:", err);
  }

  try {
    const caldavAccounts = await caldavAccountRepo.findAll();
    if (caldavAccounts.length > 0) {
      timers.push(startCalDavSyncJob(caldavService));
    } else {
      console.log("[caldav-sync] Skipped — no CalDAV accounts configured");
    }
  } catch (err) {
    console.error("[caldav-sync] Failed to check config:", err);
  }
})();

const schedulerTimers = startAgentScheduler({
  pushRepo,
  agentMemoryRepo,
  analyticsService,
  briefService,
  emailService,
  timerService: timerSessionService,
});
timers.push(schedulerTimers.mainTimer, schedulerTimers.cleanupTimer, schedulerTimers.memoryCleanupTimer);

// Seed default wellness configs
wellnessConfigService.seedDefaults().catch(console.error);

// --- Graceful shutdown ---
function shutdown() {
  console.log("[api] Shutting down gracefully...");
  for (const t of timers) clearInterval(t);
  console.log(`[api] Cleared ${timers.length} job timers`);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default {
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 255, // seconds — needed for SSE long-lived connections
};

console.log(`API running on http://localhost:${config.port}`);
