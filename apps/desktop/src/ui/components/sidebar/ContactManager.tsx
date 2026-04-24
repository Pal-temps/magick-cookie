import { createSignal, onMount, For, Show } from "solid-js";
import { useCalendarStore } from "../../../application/stores/calendarStore";
import { useT } from "../../../i18n/context";

export function ContactManager() {
  const { contacts, fetchContacts, createContact, deleteContact } = useCalendarStore();

  onMount(() => {
    if (contacts().length === 0) fetchContacts();
  });
  const { t, locale } = useT();

  const [isAdding, setIsAdding] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDate, setNewDate] = createSignal("");
  const [newPhone, setNewPhone] = createSignal("");
  const [newEmail, setNewEmail] = createSignal("");

  async function handleAdd(e: Event) {
    e.preventDefault();
    if (!newName().trim()) return;
    await createContact({
      name: newName().trim(),
      birthDate: newDate() || null,
      phone: newPhone().trim() || null,
      email: newEmail().trim() || null,
    });
    setNewName("");
    setNewDate("");
    setNewPhone("");
    setNewEmail("");
    setIsAdding(false);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale() === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" });
  }

  function secondaryInfo(c: { birthDate: string | null; phone: string | null; email: string | null }) {
    if (c.birthDate) return formatDate(c.birthDate);
    if (c.phone) return c.phone;
    if (c.email) return c.email;
    return null;
  }

  const inputStyle = {
    width: "100%",
    padding: "4px 8px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-color)",
    "border-radius": "var(--radius-sm)",
    color: "var(--text-primary)",
    "font-size": "12px",
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
      <For each={contacts()}>
        {(c) => {
          function handleDragStart(e: DragEvent) {
            const parts = [c.name];
            if (c.phone) parts.push(c.phone);
            if (c.email) parts.push(c.email);
            if (c.birthDate) parts.push(`${t("rss.birthday")}: ${new Date(c.birthDate).toLocaleDateString(locale() === "fr" ? "fr-FR" : "en-US")}`);
            const md = `**${c.name}**` + (parts.length > 1 ? ` — ${parts.slice(1).join(", ")}` : "");
            e.dataTransfer!.setData("application/x-magick-cookie", JSON.stringify({ type: "contact", markdown: md }));
            e.dataTransfer!.setData("text/plain", md);
            e.dataTransfer!.effectAllowed = "copy";
          }

          return (
          <div
            draggable={true}
            onDragStart={handleDragStart}
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "4px",
              "border-radius": "var(--radius-sm)",
              cursor: "grab",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ "font-size": "12px", flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
              {c.name}
            </span>
            <Show when={secondaryInfo(c)}>
              <span style={{ "font-size": "10px", color: "var(--text-muted)", "flex-shrink": "0" }}>
                {secondaryInfo(c)}
              </span>
            </Show>
            <button
              onClick={() => deleteContact(c.id)}
              style={{
                "font-size": "11px",
                color: "var(--text-muted)",
                cursor: "pointer",
                "flex-shrink": "0",
                padding: "0 2px",
                "line-height": "1",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              &times;
            </button>
          </div>
          );
        }}
      </For>

      <Show when={contacts().length === 0 && !isAdding()}>
        <div style={{ "font-size": "11px", color: "var(--text-muted)", padding: "4px 0" }}>
          {t("rss.noContact")}
        </div>
      </Show>

      <button
        onClick={() => setIsAdding((v) => !v)}
        style={{
          "font-size": "11px",
          color: isAdding() ? "var(--cal-red)" : "var(--accent-primary)",
          cursor: "pointer",
          padding: "4px 0",
          "margin-top": "2px",
        }}
      >
        {isAdding() ? t("common.cancel") : t("rss.addContact")}
      </button>

      <Show when={isAdding()}>
        <form onSubmit={handleAdd} style={{ display: "flex", "flex-direction": "column", gap: "4px", "margin-top": "4px" }}>
          <input
            style={inputStyle}
            placeholder={t("rss.contactName")}
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            required
          />
          <input
            type="date"
            style={{ ...inputStyle, "font-size": "11px", padding: "4px 6px" }}
            placeholder={t("rss.birthDate")}
            value={newDate()}
            onInput={(e) => setNewDate(e.currentTarget.value)}
          />
          <div style={{ display: "flex", gap: "4px" }}>
            <input
              type="tel"
              style={{ ...inputStyle, flex: "1", "font-size": "11px", padding: "4px 6px" }}
              placeholder={t("rss.phone")}
              value={newPhone()}
              onInput={(e) => setNewPhone(e.currentTarget.value)}
            />
            <input
              type="email"
              style={{ ...inputStyle, flex: "1", "font-size": "11px", padding: "4px 6px" }}
              placeholder={t("rss.email")}
              value={newEmail()}
              onInput={(e) => setNewEmail(e.currentTarget.value)}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "4px 10px",
              "font-size": "11px",
              "border-radius": "var(--radius-sm)",
              background: "var(--accent-primary)",
              color: "#fff",
              "font-weight": "600",
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </form>
      </Show>
    </div>
  );
}
