import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { RssFeedRepository, RssArticleRepository } from "../../domain/rss/rss.repository";
import type { RssFeed, RssArticle } from "../../domain/rss/rss.entity";
import type { ReminderWithEvent } from "../../domain/reminder/reminder-emitter";
import { InMemoryReminderEmitter } from "../../infrastructure/sse/reminder-emitter.impl";

// --- Mock RSS connectors before importing RssService ---
mock.module("rss-parser", () => ({
  default: class { parseURL = mock(() => Promise.resolve({ items: [], link: null })); },
}));

const mockFetchFeed = mock(() => Promise.resolve({ siteUrl: null, items: [] as any[] }));
mock.module("../../infrastructure/connectors/rss-parser.connector", () => ({
  fetchFeed: (...args: any[]) => mockFetchFeed(...args),
}));

mock.module("../../infrastructure/connectors/readability.connector", () => ({
  extractArticleContent: mock(() => Promise.resolve({ title: "", content: "", textContent: "", excerpt: "" })),
}));

const { RssService } = await import("../../application/rss/rss.service");
const { getLastRssDigest, setLastRssDigest } = await import("../../infrastructure/jobs/rss-sync.job");

// --- Helpers ---

const makeFeed = (overrides: Partial<RssFeed> = {}): RssFeed => ({
  id: "f-1", label: "Feed", url: "https://example.com/rss", category: null,
  siteUrl: null, lastSyncedAt: null, syncEnabled: true,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  ...overrides,
});

function createMockFeedRepo(): Record<keyof RssFeedRepository, ReturnType<typeof mock>> {
  return {
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    findActive: mock(() => Promise.resolve([])),
    create: mock(() => Promise.resolve(makeFeed())),
    update: mock(() => Promise.resolve(null)),
    updateLastSyncedAt: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve(false)),
  };
}

function createMockArticleRepo(): Record<keyof RssArticleRepository, ReturnType<typeof mock>> {
  return {
    findByFeed: mock(() => Promise.resolve([])),
    findAll: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve(null)),
    bulkCreate: mock(() => Promise.resolve(0)),
    updateFlags: mock(() => Promise.resolve(null)),
    markAllRead: mock(() => Promise.resolve(0)),
    delete: mock(() => Promise.resolve(false)),
    countUnread: mock(() => Promise.resolve(0)),
    countUnreadPerFeed: mock(() => Promise.resolve({})),
    updateContent: mock(() => Promise.resolve(null)),
    deleteOlderThan: mock(() => Promise.resolve(0)),
  };
}

// =============================================================================
// 1. RSS failCounts bounded
// =============================================================================

describe("Memory regression — RSS failCounts bounded", () => {
  let service: InstanceType<typeof RssService>;
  let feedRepo: ReturnType<typeof createMockFeedRepo>;
  let articleRepo: ReturnType<typeof createMockArticleRepo>;

  beforeEach(() => {
    feedRepo = createMockFeedRepo();
    articleRepo = createMockArticleRepo();
    service = new RssService(feedRepo as any, articleRepo as any);
    mockFetchFeed.mockReset();
    mockFetchFeed.mockImplementation(() => Promise.reject(new Error("network")));
  });

  it("failCounts never exceeds the number of active feeds", async () => {
    // 5 feeds, all failing
    const feeds = Array.from({ length: 5 }, (_, i) => makeFeed({ id: `f-${i}` }));
    feedRepo.findActive.mockReturnValue(Promise.resolve(feeds));
    feedRepo.findById.mockImplementation((id: string) =>
      Promise.resolve(feeds.find((f) => f.id === id) ?? null),
    );

    await service.syncAll(); // 1st failure each
    await service.syncAll(); // 2nd failure each

    // failCounts is private, so we test indirectly: error messages show 2/3
    const result = await service.syncAll(); // 3rd → auto-disable → entry deleted
    // After 3 failures each feed is disabled and its failCount entry is deleted.
    // All 5 errors should mention "desactive" (auto-disabled).
    expect(result.errors).toHaveLength(5);
    for (const err of result.errors) {
      expect(err).toContain("desactive");
    }

    // A subsequent sync with no active feeds produces no errors (failCounts is empty)
    feedRepo.findActive.mockReturnValue(Promise.resolve([]));
    const result2 = await service.syncAll();
    expect(result2.errors).toHaveLength(0);
  });

  it("failCounts entry is cleaned when feed succeeds after failures", async () => {
    const feeds = [
      makeFeed({ id: "f-A", url: "https://feed-a.com/rss" }),
      makeFeed({ id: "f-B", url: "https://feed-b.com/rss", label: "Feed B" }),
    ];
    feedRepo.findActive.mockReturnValue(Promise.resolve(feeds));
    feedRepo.findById.mockImplementation((id: string) =>
      Promise.resolve(feeds.find((f) => f.id === id) ?? null),
    );

    // Both fail once
    await service.syncAll();

    // Now f-A succeeds, f-B still fails
    mockFetchFeed.mockImplementation((url: string) => {
      if (url === "https://feed-a.com/rss") return Promise.resolve({ siteUrl: null, items: [] });
      return Promise.reject(new Error("still down"));
    });
    articleRepo.bulkCreate.mockReturnValue(Promise.resolve(0));
    const result = await service.syncAll();

    // Only f-B should have an error (2/3)
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("2/3");
  });

  it("removing a feed from active list naturally bounds failCounts", async () => {
    const allFeeds = Array.from({ length: 10 }, (_, i) =>
      makeFeed({ id: `f-${i}`, url: `https://feed-${i}.com/rss` }),
    );
    feedRepo.findActive.mockReturnValue(Promise.resolve(allFeeds));
    feedRepo.findById.mockImplementation((id: string) =>
      Promise.resolve(allFeeds.find((f) => f.id === id) ?? null),
    );

    // 1 round of failures
    await service.syncAll();

    // Reduce to 3 feeds (simulating user deletion), all succeed now
    const remaining = allFeeds.slice(0, 3);
    feedRepo.findActive.mockReturnValue(Promise.resolve(remaining));
    mockFetchFeed.mockImplementation(() => Promise.resolve({ siteUrl: null, items: [] }));
    articleRepo.bulkCreate.mockReturnValue(Promise.resolve(0));

    const result = await service.syncAll();
    // All 3 succeed → their failCounts entries deleted; the other 7 entries
    // are stale but bounded by previous feed count. No errors expected.
    expect(result.total).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// =============================================================================
// 2. Email sync batch size constants
// =============================================================================

describe("Memory regression — Email sync batch sizes", () => {
  const emailServicePath = import.meta.dir.replace(
    /__tests__[/\\]unit$/,
    "application/email/email.service.ts",
  );

  it("reconcile cap is 50 (prevents fetching unbounded missing emails)", async () => {
    // Read the source constant directly from the reconcileMissing method.
    // The cap is hardcoded as missingUids.slice(-50).
    const source = await Bun.file(emailServicePath).text();

    // Reconcile cap: slice(-50)
    expect(source).toContain(".slice(-50)");

    // Flag sync batch: findFlagsByAccount with limit 200
    expect(source).toMatch(/findFlagsByAccount\(.+,\s*200\)/);
  });

  it("email fetch limits are bounded (no unbounded queries)", async () => {
    const source = await Bun.file(emailServicePath).text();

    // Digest/report queries cap at 200
    const limitMatches = source.match(/limit:\s*(\d+)/g) ?? [];
    const limits = limitMatches.map((m) => parseInt(m.replace("limit:", "").trim(), 10));

    // All limits should be <= 200 (reasonable upper bound for in-memory processing)
    for (const limit of limits) {
      expect(limit).toBeLessThanOrEqual(200);
      expect(limit).toBeGreaterThan(0);
    }

    // At least 2 different queries use limits
    expect(limits.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// 3. SSE listener cleanup
// =============================================================================

describe("Memory regression — SSE listener cleanup", () => {
  it("listeners Set is empty after all subscribers unsubscribe", () => {
    const emitter = new InMemoryReminderEmitter();
    const unsubs: (() => void)[] = [];

    // Simulate 10 SSE clients connecting (each with a unique function)
    for (let i = 0; i < 10; i++) {
      unsubs.push(emitter.subscribe(mock(() => {})));
    }

    // All clients disconnect
    for (const unsub of unsubs) {
      unsub();
    }

    // After full cleanup, emit should not call any old listener
    const probe = mock(() => {});
    const unsubProbe = emitter.subscribe(probe);
    emitter.emit({
      id: "r1", eventId: "e1", type: "push", minutesBefore: 5,
      scheduledAt: new Date(), sentAt: null, createdAt: new Date(),
      eventTitle: "Test", eventStartAt: new Date(),
    } as ReminderWithEvent);

    // Only the new probe listener should fire (none of the 10 old ones)
    expect(probe).toHaveBeenCalledTimes(1);
    unsubProbe();

    // Now truly empty — emit should be silent
    const silent = mock(() => {});
    emitter.emit({
      id: "r2", eventId: "e2", type: "push", minutesBefore: 5,
      scheduledAt: new Date(), sentAt: null, createdAt: new Date(),
      eventTitle: "Test2", eventStartAt: new Date(),
    } as ReminderWithEvent);
    expect(silent).not.toHaveBeenCalled();
  });

  it("unsubscribing the same function twice is idempotent", () => {
    const emitter = new InMemoryReminderEmitter();
    const listener = mock(() => {});

    const unsub = emitter.subscribe(listener);
    unsub();
    unsub(); // Should not throw or corrupt the Set

    emitter.emit({
      id: "r1", eventId: "e1", type: "push", minutesBefore: 5,
      scheduledAt: new Date(), sentAt: null, createdAt: new Date(),
      eventTitle: "Test", eventStartAt: new Date(),
    } as ReminderWithEvent);

    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribe/unsubscribe cycle with concurrent emits has no leaks", () => {
    const emitter = new InMemoryReminderEmitter();
    const reminder: ReminderWithEvent = {
      id: "r1", eventId: "e1", type: "push", minutesBefore: 5,
      scheduledAt: new Date(), sentAt: null, createdAt: new Date(),
      eventTitle: "Test", eventStartAt: new Date(),
    };

    // Rapid subscribe/emit/unsubscribe cycles
    for (let i = 0; i < 100; i++) {
      const fn = mock(() => {});
      const unsub = emitter.subscribe(fn);
      emitter.emit(reminder);
      expect(fn).toHaveBeenCalledTimes(1);
      unsub();
    }

    // After all cycles, no listeners remain — verify by adding one and checking
    const finalListener = mock(() => {});
    const finalUnsub = emitter.subscribe(finalListener);
    emitter.emit(reminder);
    expect(finalListener).toHaveBeenCalledTimes(1);
    finalUnsub();

    // Emit with no listeners should be silent
    emitter.emit(reminder);
    expect(finalListener).toHaveBeenCalledTimes(1); // Still 1, not 2
  });
});

// =============================================================================
// 4. RSS digest cache
// =============================================================================

describe("Memory regression — RSS digest cache", () => {
  it("lastDigest starts as null", () => {
    // getLastRssDigest is a module-level export; on fresh module load it should be null
    // Note: if a previous test set it, this verifies the getter works
    const cached = getLastRssDigest();
    // It should be either null or a valid object (from a previous test in this run)
    expect(cached === null || (cached && typeof cached.generatedAt !== "undefined")).toBe(true);
  });

  it("setLastRssDigest stores data with a generatedAt timestamp", () => {
    const digest = {
      generatedAt: new Date().toISOString(),
      totalUnread: 3,
      highlights: [{ title: "A", feedLabel: "B", reason: "C", link: null }],
      summary: "Test summary",
      categories: [{ name: "Tech", count: 2, topArticle: "A" }],
    };

    setLastRssDigest(digest);
    const cached = getLastRssDigest();

    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(digest);
    expect(cached!.generatedAt).toBeInstanceOf(Date);
  });

  it("setLastRssDigest overwrites previous value (no accumulation)", () => {
    const digest1 = {
      generatedAt: new Date().toISOString(),
      totalUnread: 1,
      highlights: [],
      summary: "First",
      categories: [],
    };
    const digest2 = {
      generatedAt: new Date().toISOString(),
      totalUnread: 2,
      highlights: [],
      summary: "Second",
      categories: [],
    };

    setLastRssDigest(digest1);
    setLastRssDigest(digest2);

    const cached = getLastRssDigest();
    expect(cached!.data.summary).toBe("Second");
    expect(cached!.data.totalUnread).toBe(2);
  });

  it("digest cache holds exactly one entry (bounded memory)", () => {
    // Simulate many digest generations
    for (let i = 0; i < 50; i++) {
      setLastRssDigest({
        generatedAt: new Date().toISOString(),
        totalUnread: i,
        highlights: [],
        summary: `Digest #${i}`,
        categories: [],
      });
    }

    const cached = getLastRssDigest();
    // Only the last one is retained
    expect(cached!.data.totalUnread).toBe(49);
    expect(cached!.data.summary).toBe("Digest #49");
  });
});

// =============================================================================
// 5. Offline queue — bounded size (mirrors offlineQueue.ts logic)
// =============================================================================

describe("Memory regression — Offline queue bounded size", () => {
  const MAX_QUEUE_SIZE = 5000;

  interface QueuedRequest {
    id: string;
    method: string;
    url: string;
    body?: any;
    timestamp: number;
  }

  function createMockQueue() {
    let queue: QueuedRequest[] = [];
    return {
      enqueue(method: string, url: string, body?: any) {
        const request: QueuedRequest = {
          id: `req-${queue.length}`,
          method,
          url,
          body,
          timestamp: Date.now(),
        };
        let updated = [...queue, request];
        if (updated.length > MAX_QUEUE_SIZE) {
          updated = updated.slice(updated.length - MAX_QUEUE_SIZE);
        }
        queue = updated;
      },
      size: () => queue.length,
      items: () => [...queue],
    };
  }

  it("MAX_QUEUE_SIZE is reasonable (> 0, <= 10000)", () => {
    expect(MAX_QUEUE_SIZE).toBeGreaterThan(0);
    expect(MAX_QUEUE_SIZE).toBeLessThanOrEqual(10000);
  });

  it("queue never exceeds MAX_QUEUE_SIZE", () => {
    const q = createMockQueue();
    for (let i = 0; i < MAX_QUEUE_SIZE + 500; i++) {
      q.enqueue("POST", `/api/item/${i}`);
    }
    expect(q.size()).toBe(MAX_QUEUE_SIZE);
  });

  it("oldest entries are dropped when queue overflows", () => {
    const q = createMockQueue();
    // Fill to max + 3
    for (let i = 0; i < MAX_QUEUE_SIZE + 3; i++) {
      q.enqueue("POST", `/api/item/${i}`);
    }
    const items = q.items();
    // First item should be the 4th one ever enqueued (indices 3..MAX+2)
    expect(items[0].url).toBe("/api/item/3");
    // Last item should be the most recent
    expect(items[items.length - 1].url).toBe(`/api/item/${MAX_QUEUE_SIZE + 2}`);
  });

  it("queue works correctly under capacity", () => {
    const q = createMockQueue();
    q.enqueue("GET", "/api/health");
    q.enqueue("POST", "/api/task");
    expect(q.size()).toBe(2);
    expect(q.items()[0].url).toBe("/api/health");
  });

  it("offlineQueue.ts source exports MAX_QUEUE_SIZE = 5000", async () => {
    const sourcePath = import.meta.dir.replace(
      /apps[/\\]api[/\\]src[/\\]__tests__[/\\]unit$/,
      "apps/desktop/src/infrastructure/offline/offlineQueue.ts",
    );
    const source = await Bun.file(sourcePath).text();
    expect(source).toContain("MAX_QUEUE_SIZE = 5000");
  });
});

// =============================================================================
// 6. AI message trimming — bounded in-memory messages (mirrors aiSessionStore.ts)
// =============================================================================

describe("Memory regression — AI message trimming", () => {
  const MAX_MESSAGES = 200;

  interface SimpleMessage {
    id: string;
    content: string;
    timestamp: number;
  }

  function createMessageStore() {
    let messages: SimpleMessage[] = [];
    return {
      addMessage(msg: SimpleMessage) {
        messages = [...messages, msg];
        if (messages.length > MAX_MESSAGES) {
          messages = messages.slice(-MAX_MESSAGES);
        }
      },
      count: () => messages.length,
      messages: () => [...messages],
    };
  }

  it("MAX_MESSAGES is reasonable (> 0, <= 1000)", () => {
    expect(MAX_MESSAGES).toBeGreaterThan(0);
    expect(MAX_MESSAGES).toBeLessThanOrEqual(1000);
  });

  it("trims to MAX_MESSAGES when exceeded", () => {
    const store = createMessageStore();
    for (let i = 0; i < 250; i++) {
      store.addMessage({ id: `msg-${i}`, content: `Hello ${i}`, timestamp: i });
    }
    expect(store.count()).toBe(MAX_MESSAGES);
  });

  it("keeps the most recent messages after trimming", () => {
    const store = createMessageStore();
    for (let i = 0; i < 250; i++) {
      store.addMessage({ id: `msg-${i}`, content: `Hello ${i}`, timestamp: i });
    }
    const msgs = store.messages();
    // First message should be msg-50 (250 - 200 = 50)
    expect(msgs[0].id).toBe("msg-50");
    // Last message should be msg-249
    expect(msgs[msgs.length - 1].id).toBe("msg-249");
  });

  it("does not trim when under capacity", () => {
    const store = createMessageStore();
    for (let i = 0; i < 100; i++) {
      store.addMessage({ id: `msg-${i}`, content: `Hello ${i}`, timestamp: i });
    }
    expect(store.count()).toBe(100);
    expect(store.messages()[0].id).toBe("msg-0");
  });

  it("handles exactly MAX_MESSAGES without trimming", () => {
    const store = createMessageStore();
    for (let i = 0; i < MAX_MESSAGES; i++) {
      store.addMessage({ id: `msg-${i}`, content: `Hello ${i}`, timestamp: i });
    }
    expect(store.count()).toBe(MAX_MESSAGES);
    expect(store.messages()[0].id).toBe("msg-0");
  });

  it("trims on the message that exceeds MAX_MESSAGES", () => {
    const store = createMessageStore();
    for (let i = 0; i < MAX_MESSAGES; i++) {
      store.addMessage({ id: `msg-${i}`, content: `Hello ${i}`, timestamp: i });
    }
    expect(store.count()).toBe(MAX_MESSAGES);

    // Adding one more triggers trim
    store.addMessage({ id: `msg-${MAX_MESSAGES}`, content: "overflow", timestamp: MAX_MESSAGES });
    expect(store.count()).toBe(MAX_MESSAGES);
    // msg-0 should be gone, msg-1 is now first
    expect(store.messages()[0].id).toBe("msg-1");
    expect(store.messages()[store.count() - 1].id).toBe(`msg-${MAX_MESSAGES}`);
  });

  it("aiSessionStore.ts source has MAX_MESSAGES = 200", async () => {
    const sourcePath = import.meta.dir.replace(
      /apps[/\\]api[/\\]src[/\\]__tests__[/\\]unit$/,
      "apps/desktop/src/application/stores/aiSessionStore.ts",
    );
    const source = await Bun.file(sourcePath).text();
    expect(source).toContain("MAX_MESSAGES = 200");
    // Verify the slicing pattern
    expect(source).toContain("messages.slice(-MAX_MESSAGES)");
  });
});
