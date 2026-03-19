import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import type { EmailAccount, CreateEmailInput, EmailAddress } from "../../domain/email/email.entity";

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

const IMAP_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[imap] ${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export class ImapConnector {
  private createClient(config: ImapConfig): ImapFlow {
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
      logger: false,
      tls: {
        rejectUnauthorized: true,
        servername: config.host,
      },
    });
    // Prevent unhandled 'error' event from crashing the process
    client.on("error", (err: Error) => {
      console.error(`[imap] Client error (${config.host}):`, err.message);
    });
    return client;
  }

  private async connectWithTimeout(client: ImapFlow): Promise<void> {
    await withTimeout(client.connect(), IMAP_TIMEOUT_MS, "connect");
  }

  async fetchNewEmails(
    account: EmailAccount,
    password: string,
    folder: string = "INBOX",
    sinceUid?: number,
  ): Promise<CreateEmailInput[]> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
    });

    const results: CreateEmailInput[] = [];

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);

      try {
        const range = sinceUid ? `${sinceUid + 1}:*` : "1:*";
        const messages = client.fetch(range, {
          uid: true,
          flags: true,
          envelope: true,
          source: true,
        }, { uid: true });

        for await (const msg of messages) {
          try {
            if (!msg.source) continue;
            const parsed: ParsedMail = await simpleParser(msg.source);

            const fromAddr = parsed.from?.value?.[0];
            const toRaw = parsed.to;
            const toAddrs: EmailAddress[] = toRaw
              ? (Array.isArray(toRaw) ? toRaw : [toRaw])
                  .flatMap((t: { value: Array<{ name?: string; address?: string }> }) => t.value)
                  .map((a: { name?: string; address?: string }) => ({ name: a.name || null, address: a.address || "" }))
              : [];
            const ccRaw = parsed.cc;
            const ccAddrs: EmailAddress[] = ccRaw
              ? (Array.isArray(ccRaw) ? ccRaw : [ccRaw])
                  .flatMap((t: { value: Array<{ name?: string; address?: string }> }) => t.value)
                  .map((a: { name?: string; address?: string }) => ({ name: a.name || null, address: a.address || "" }))
              : [];

            const attachmentNames = (parsed.attachments || [])
              .map((a: { filename?: string }) => a.filename)
              .filter((n: string | undefined): n is string => !!n);

            results.push({
              accountId: account.id,
              messageId: parsed.messageId || `uid-${msg.uid}-${account.id}`,
              imapUid: msg.uid,
              subject: parsed.subject || null,
              fromAddress: fromAddr?.address || "unknown",
              fromName: fromAddr?.name || null,
              toAddresses: toAddrs,
              ccAddresses: ccAddrs,
              bodyText: parsed.text || null,
              bodyHtml: parsed.html || null,
              hasAttachments: attachmentNames.length > 0,
              attachmentNames,
              isRead: msg.flags?.has("\\Seen") ?? false,
              folder,
              sentAt: parsed.date || new Date(),
            });
          } catch (err) {
            console.error(`[imap] Failed to parse message UID ${msg.uid}:`, err);
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }

    return results;
  }

  async testConnection(config: ImapConfig): Promise<boolean> {
    const client = this.createClient(config);
    try {
      await this.connectWithTimeout(client);
      await client.logout();
      return true;
    } catch {
      return false;
    }
  }

  async markRead(account: EmailAccount, password: string, uid: number, folder: string = "INBOX"): Promise<void> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd({ uid: uid }, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async markUnread(account: EmailAccount, password: string, uid: number, folder: string = "INBOX"): Promise<void> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsRemove({ uid: uid }, ["\\Seen"], { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async deleteMessage(account: EmailAccount, password: string, uid: number, folder: string = "INBOX"): Promise<void> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd({ uid: uid }, ["\\Deleted"], { uid: true });
        await client.messageDelete({ uid: uid }, { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }
}
