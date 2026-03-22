import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { db } from "./infrastructure/database/client";
import { errorHandler } from "./presentation/middleware/error-handler";

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
import { DrizzleTriageRepository } from "./infrastructure/repositories/triage.repository.impl";
import { DrizzleEmailAccountRepository } from "./infrastructure/repositories/email-account.repository.impl";
import { DrizzleEmailRepository } from "./infrastructure/repositories/email.repository.impl";
import { DrizzleLlmConfigRepository } from "./infrastructure/repositories/llm-config.repository.impl";
import { DrizzleChatRepository } from "./infrastructure/repositories/chat.repository.impl";
import { DrizzleBookmarkRepository } from "./infrastructure/repositories/bookmark.repository.impl";
import { DrizzleBookmarkTagRepository } from "./infrastructure/repositories/bookmark-tag.repository.impl";
import { DrizzleBookmarkCategoryRepository } from "./infrastructure/repositories/bookmark-category.repository.impl";
import { DrizzleProjectRepository } from "./infrastructure/repositories/project.repository.impl";
import { DrizzlePushNotificationRepository } from "./infrastructure/repositories/push-notification.repository.impl";
import { DrizzleAgentMemoryRepository } from "./infrastructure/repositories/agent-memory.repository.impl";
import { DrizzleGitHubConfigRepository } from "./infrastructure/repositories/github-config.repository.impl";
import { DrizzleGitHubPRRepository } from "./infrastructure/repositories/github-pr.repository.impl";
import { DrizzleAlarmRepository } from "./infrastructure/repositories/alarm.repository.impl";
import { DrizzleRssFeedRepository } from "./infrastructure/repositories/rss-feed.repository.impl";
import { DrizzleRssArticleRepository } from "./infrastructure/repositories/rss-article.repository.impl";
import { DrizzleSnippetRepository } from "./infrastructure/repositories/snippet.repository.impl";
import { DrizzleSnippetCategoryRepository } from "./infrastructure/repositories/snippet-category.repository.impl";
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
import { ClickUpSyncService } from "./application/connector/clickup-sync.service";
import { TimerSessionService } from "./application/timer-session/timer-session.service";
import { WellnessConfigService } from "./application/wellness-config/wellness-config.service";
import { WellnessLogService } from "./application/wellness-log/wellness-log.service";
import { DogWalkService } from "./application/dog-walk/dog-walk.service";
import { TriageService } from "./application/triage/triage.service";
import { EmailService } from "./application/email/email.service";
import { AnalyticsService } from "./application/analytics/analytics.service";
import { LlmService } from "./application/llm/llm.service";
import { BriefService } from "./application/brief/brief.service";
import { ChatService } from "./application/chat/chat.service";
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
import { createAnalyticsTools } from "./application/agent/tools/analytics.tools";
import { createTaskTools } from "./application/agent/tools/task.tools";
import { createTimerTools } from "./application/agent/tools/timer.tools";
import { createBriefTools, createEmailTools, createCalendarTools, createBookmarkTools, createProjectTools } from "./application/agent/tools/brief.tools";
import { createMemoryTools } from "./application/agent/tools/memory.tools";
import { createCodeTools } from "./application/agent/tools/code.tools";

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
import { createTriageRoutes } from "./presentation/routes/triage.routes";
import { createEmailRoutes, createEmailAccountRoutes } from "./presentation/routes/email.routes";
import { createAnalyticsRoutes } from "./presentation/routes/analytics.routes";
import { createLlmRoutes } from "./presentation/routes/llm.routes";
import { createCodeRoutes } from "./presentation/routes/code.routes";
import { createBriefRoutes } from "./presentation/routes/brief.routes";
import { createChatRoutes } from "./presentation/routes/chat.routes";
import { createGitHubRoutes } from "./presentation/routes/github.routes";
import { createVpsRoutes } from "./presentation/routes/vps.routes";
import { createBookmarkRoutes } from "./presentation/routes/bookmark.routes";
import { createProjectRoutes } from "./presentation/routes/project.routes";
import { createSmartReminderRoutes } from "./presentation/routes/smart-reminder.routes";
import { createAgentRoutes } from "./presentation/routes/agent.routes";
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
const triageRepo = new DrizzleTriageRepository(db);
const emailAccountRepo = new DrizzleEmailAccountRepository(db);
const emailRepo = new DrizzleEmailRepository(db);
const llmConfigRepo = new DrizzleLlmConfigRepository(db);
const chatRepo = new DrizzleChatRepository(db);
const bookmarkRepo = new DrizzleBookmarkRepository(db);
const bookmarkTagRepo = new DrizzleBookmarkTagRepository(db);
const bookmarkCategoryRepo = new DrizzleBookmarkCategoryRepository(db);
const projectRepo = new DrizzleProjectRepository(db);
const pushRepo = new DrizzlePushNotificationRepository(db);
const agentMemoryRepo = new DrizzleAgentMemoryRepository(db);
const githubConfigRepo = new DrizzleGitHubConfigRepository(db);
const githubPrRepo = new DrizzleGitHubPRRepository(db);
const alarmRepo = new DrizzleAlarmRepository(db);
const rssFeedRepo = new DrizzleRssFeedRepository(db);
const rssArticleRepo = new DrizzleRssArticleRepository(db);
const snippetRepo = new DrizzleSnippetRepository(db);
const snippetCategoryRepo = new DrizzleSnippetCategoryRepository(db);
const caldavAccountRepo = new DrizzleCalDavAccountRepository(db);
const emailRuleRepo = new DrizzleEmailRuleRepository(db);
const routineRepo = new DrizzleRoutineRepository(db);
const webhookRepo = new DrizzleWebhookRepository(db);
const userPreferencesRepo = new DrizzleUserPreferencesRepository(db);
const connectorConfigRepo = new DrizzleConnectorConfigRepository(db);

const calendarService = new CalendarService(calendarRepo);
const eventService = new EventService(eventRepo, reminderRepo);
const reminderService = new ReminderService(reminderRepo, eventRepo);
const contactService = new ContactService(contactRepo);
const taskService = new TaskService(taskRepo);
const timerSessionService = new TimerSessionService(timerSessionRepo);
const wellnessConfigService = new WellnessConfigService(wellnessConfigRepo);
const wellnessLogService = new WellnessLogService(wellnessLogRepo);
const dogWalkService = new DogWalkService(dogWalkRepo);
const imapConnector = new ImapConnector();
const smtpConnector = new SmtpConnector();
const emailService = new EmailService(emailAccountRepo, emailRepo, imapConnector, smtpConnector);
const analyticsService = new AnalyticsService(timerSessionRepo, dogWalkRepo, wellnessLogRepo, triageRepo, emailRepo, eventRepo, taskRepo, projectRepo);
const llmService = new LlmService(llmConfigRepo);
const triageService = new TriageService(triageRepo, taskRepo, llmService);
const gitRepoPaths = process.env.GIT_SCAN_REPOS?.split(",").map((p) => p.trim()).filter(Boolean) || [];
const gitExecAdapter = new GitExecAdapter();
const gitScanService = gitRepoPaths.length > 0 ? new GitScanService(gitRepoPaths, gitExecAdapter) : undefined;
const briefService = new BriefService(timerSessionRepo, eventRepo, taskRepo, triageRepo, emailRepo, llmService, gitScanService);
const chatService = new ChatService(chatRepo, llmService);
const githubService = new GitHubService(githubConfigRepo, githubPrRepo);
const vpsProxyService = new VpsProxyService(config.vpsApiUrl, config.vpsApiToken);
const bookmarkService = new BookmarkService(bookmarkRepo, bookmarkTagRepo, bookmarkCategoryRepo);
const projectService = new ProjectService(projectRepo);
const smartReminderService = new SmartReminderService(triageRepo, taskRepo, emailRepo);
const alarmService = new AlarmService(alarmRepo);
const rssService = new RssService(rssFeedRepo, rssArticleRepo);
rssService.setLlmService(llmService);
const snippetService = new SnippetService(snippetRepo, snippetCategoryRepo);
const changelogService = new ChangelogService(gitScanService, llmService);
const caldavConnector = new CalDavConnector();
const caldavService = new CalDavService(caldavAccountRepo, caldavConnector, eventRepo);
const emailRuleService = new EmailRuleService(emailRuleRepo);
emailService.setEmailRuleService(emailRuleService);
const routineService = new RoutineService(routineRepo);
const webhookService = new WebhookService(webhookRepo);
const userPreferencesService = new UserPreferencesService(userPreferencesRepo);

// Agent (tool-calling chat)
const toolRegistry = new ToolRegistry();
toolRegistry.registerAll(createAnalyticsTools(analyticsService));
toolRegistry.registerAll(createTaskTools(taskService, triageService));
toolRegistry.registerAll(createTimerTools(timerSessionService));
toolRegistry.registerAll(createBriefTools(briefService));
toolRegistry.registerAll(createEmailTools(emailService, llmService));
toolRegistry.registerAll(createCalendarTools(eventService));
toolRegistry.registerAll(createBookmarkTools(bookmarkService));
toolRegistry.registerAll(createProjectTools(projectService));
toolRegistry.registerAll(createMemoryTools(agentMemoryRepo));
toolRegistry.registerAll(createCodeTools());
const agentService = new AgentService(chatRepo, llmService, toolRegistry, agentMemoryRepo);

const clickUpSyncService = new ClickUpSyncService(connectorConfigRepo, calendarService, eventRepo, taskRepo);
const connectorConfigService = new ConnectorConfigService(connectorConfigRepo);
const githubSyncService = new GitHubSyncService(connectorConfigRepo, calendarService, eventRepo, taskRepo);
const gitlabSyncService = new GitLabSyncService(connectorConfigRepo, calendarService, eventRepo, taskRepo);

const reminderEmitter = new InMemoryReminderEmitter();

// --- App ---
const app = new Hono();

app.use("/*", cors());
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
app.route("/api/tasks", createTaskRoutes(taskService, connectorConfigRepo));
app.route("/api/connector-configs", createConnectorConfigRoutes(connectorConfigService));
app.route("/api/timer-sessions", createTimerSessionRoutes(timerSessionService));
app.route("/api/wellness-configs", createWellnessConfigRoutes(wellnessConfigService));
app.route("/api/wellness-logs", createWellnessLogRoutes(wellnessLogService));
app.route("/api/dog-walks", createDogWalkRoutes(dogWalkService));
app.route("/api/triage", createTriageRoutes(triageService));
app.route("/api/emails", createEmailRoutes(emailService, llmService));
app.route("/api/email-accounts", createEmailAccountRoutes(emailService));
app.route("/api/analytics", createAnalyticsRoutes(analyticsService, llmService));
app.route("/api/llm", createLlmRoutes(llmService));
app.route("/api/code", createCodeRoutes(llmService));
app.route("/api/brief", createBriefRoutes(briefService));
app.route("/api/chat", createChatRoutes(chatService));
app.route("/api/github", createGitHubRoutes(githubService));
app.route("/api/vps", createVpsRoutes(vpsProxyService));
app.route("/api/bookmarks", createBookmarkRoutes(bookmarkService));
app.route("/api/projects", createProjectRoutes(projectService));
app.route("/api/smart-reminders", createSmartReminderRoutes(smartReminderService));
app.route("/api/agent", createAgentRoutes(agentService));
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

// Start reminder checker — pushes to SSE, does NOT mark as sent
startReminderChecker(reminderService, eventRepo, reminderEmitter);

// Start email sync job
startEmailSyncJob(emailService);

// Start GitHub sync job
startGitHubSyncJob(githubService);

// Start agent scheduler (proactive notifications)
startAgentScheduler({
  pushRepo,
  agentMemoryRepo,
  analyticsService,
  briefService,
  emailService,
  timerService: timerSessionService,
});

// Start GitHub issue sync job
startGitHubIssueSyncJob(githubSyncService);

// Start GitLab sync job
startGitLabSyncJob(gitlabSyncService);

// Start RSS sync job
startRssSyncJob(rssService);

// Start CalDAV sync job
startCalDavSyncJob(caldavService);

// Seed default wellness configs
wellnessConfigService.seedDefaults().catch(console.error);


export default {
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 255, // seconds — needed for SSE long-lived connections
};

console.log(`API running on http://localhost:${config.port}`);
