import { ImapFlow } from "imapflow";
import tls from "node:tls";
import { simpleParser, type ParsedMail } from "mailparser";
import type { EmailAccount, CreateEmailInput, EmailAddress } from "../../domain/email/email.entity";

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  selfSigned?: boolean;
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
        rejectUnauthorized: !config.selfSigned,
        servername: config.host,
        checkServerIdentity: (hostname: string, cert: tls.PeerCertificate) => {
          if (!cert) return undefined; // Avoid crash on null cert during failed handshake
          return tls.checkServerIdentity(hostname, cert);
        },
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
    sinceDays: number = 30,
  ): Promise<CreateEmailInput[]> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    const results: CreateEmailInput[] = [];

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);

      try {
        let messages;
        if (sinceUid) {
          // Incremental sync: fetch only new messages since last known UID
          messages = client.fetch(`${sinceUid + 1}:*`, {
            uid: true,
            flags: true,
            envelope: true,
            source: true,
          }, { uid: true });
        } else {
          // First/full sync: search emails since N days ago
          const since = new Date();
          since.setDate(since.getDate() - sinceDays);
          const uids = await client.search({ since }, { uid: true });
          if (!uids || uids.length === 0) {
            lock.release();
            return results;
          }
          // Take the most recent UIDs (capped at 500 for safety)
          const recentUids = uids.slice(-500);
          const uidRange = recentUids.join(",");
          messages = client.fetch(uidRange, {
            uid: true,
            flags: true,
            envelope: true,
            source: true,
          }, { uid: true });
        }

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
      selfSigned: account.selfSigned,
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
      selfSigned: account.selfSigned,
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

  async fetchByUids(
    account: EmailAccount,
    password: string,
    folder: string,
    uids: number[],
  ): Promise<CreateEmailInput[]> {
    if (uids.length === 0) return [];

    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    const results: CreateEmailInput[] = [];

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        const uidRange = uids.join(",");
        const messages = client.fetch(uidRange, {
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

  async listRecentUids(
    account: EmailAccount,
    password: string,
    folder: string,
    sinceDays: number = 30,
  ): Promise<number[]> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        const uids = await client.search({ since }, { uid: true });
        return uids || [];
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async fetchFlags(
    account: EmailAccount,
    password: string,
    folder: string,
    uids: number[],
  ): Promise<Map<number, { seen: boolean; flagged: boolean }>> {
    const result = new Map<number, { seen: boolean; flagged: boolean }>();
    if (uids.length === 0) return result;

    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        const uidRange = uids.join(",");
        const messages = client.fetch(uidRange, { uid: true, flags: true }, { uid: true });
        for await (const msg of messages) {
          result.set(msg.uid, {
            seen: msg.flags?.has("\\Seen") ?? false,
            flagged: msg.flags?.has("\\Flagged") ?? false,
          });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }

    return result;
  }

  async markStarred(account: EmailAccount, password: string, uid: number, folder: string = "INBOX"): Promise<void> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd({ uid: uid }, ["\\Flagged"], { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async markUnstarred(account: EmailAccount, password: string, uid: number, folder: string = "INBOX"): Promise<void> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsRemove({ uid: uid }, ["\\Flagged"], { uid: true });
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async moveMessage(account: EmailAccount, password: string, uid: number, fromFolder: string, toFolder: string): Promise<void> {
    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(fromFolder);
      try {
        await client.messageMove({ uid }, toFolder, { uid: true });
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
      selfSigned: account.selfSigned,
    });

    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        // Gmail ignores \Deleted flag — must MOVE to Trash instead
        const trashFolder = await this.findTrashFolder(client, account.imapHost);
        if (trashFolder && folder !== trashFolder) {
          await client.messageMove({ uid: uid }, trashFolder, { uid: true });
        } else {
          // Fallback for non-Gmail: standard delete
          await client.messageFlagsAdd({ uid: uid }, ["\\Deleted"], { uid: true });
          await client.messageDelete({ uid: uid }, { uid: true });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  private async findTrashFolder(client: ImapFlow, host: string): Promise<string | null> {
    try {
      const mailboxes = await client.list();
      // Gmail uses [Gmail]/Trash or [Gmail]/Corbeille (localized)
      for (const mb of mailboxes) {
        if (mb.specialUse === "\\Trash") return mb.path;
      }
      // Fallback: common trash folder names
      const trashNames = ["[Gmail]/Trash", "[Gmail]/Corbeille", "Trash", "Deleted", "Deleted Items"];
      for (const name of trashNames) {
        if (mailboxes.some((mb) => mb.path === name)) return name;
      }
    } catch (err) {
      console.error(`[imap] Failed to list mailboxes for trash detection:`, err);
    }
    return null;
  }

  async bulkDeleteMessages(account: EmailAccount, password: string, uids: number[], folder: string = "INBOX"): Promise<number> {
    if (uids.length === 0) return 0;

    const client = this.createClient({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
      selfSigned: account.selfSigned,
    });

    let deleted = 0;
    try {
      await this.connectWithTimeout(client);
      const lock = await client.getMailboxLock(folder);
      try {
        const uidRange = uids.join(",");
        const trashFolder = await this.findTrashFolder(client, account.imapHost);
        if (trashFolder && folder !== trashFolder) {
          await client.messageMove(uidRange, trashFolder, { uid: true });
        } else {
          await client.messageFlagsAdd(uidRange, ["\\Deleted"], { uid: true });
          await client.messageDelete(uidRange, { uid: true });
        }
        deleted = uids.length;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }

    return deleted;
  }
}
