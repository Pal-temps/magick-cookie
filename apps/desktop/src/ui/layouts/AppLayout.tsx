import type { JSX } from "solid-js";
import { useViewStore } from "../../application/stores/viewStore";
import { useCalendarStore } from "../../application/stores/calendarStore";
import { MiniCalendar } from "../components/sidebar/MiniCalendar";
import { CalendarList } from "../components/sidebar/CalendarList";
import { UnscheduledTasks } from "../components/sidebar/UnscheduledTasks";
import { ContactManager } from "../components/sidebar/ContactManager";
import { CollapsibleSection } from "../components/common/CollapsibleSection";
import { Button } from "../components/common/Button";

interface AppLayoutProps {
  children: JSX.Element;
}

export function AppLayout(props: AppLayoutProps) {
  const { viewMode, setViewMode, currentDate, navigatePrev, navigateNext, goToToday } = useViewStore();
  const { openCreateForm, syncClickUp, isSyncing, unscheduledTasks, contacts } = useCalendarStore();

  const headerTitle = () => {
    const d = currentDate();
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside style={{
        width: "var(--sidebar-width)",
        "min-width": "var(--sidebar-width)",
        background: "var(--bg-surface)",
        "border-right": "1px solid var(--border-color)",
        display: "flex",
        "flex-direction": "column",
        overflow: "hidden",
      }}>
        {/* Top actions */}
        <div style={{ padding: "10px 12px", display: "flex", gap: "6px" }}>
          <Button variant="primary" onClick={openCreateForm} style={{ flex: "1" }} size="sm">
            + Evenement
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={syncClickUp}
            disabled={isSyncing()}
            style={{ "flex-shrink": "0", "font-size": "11px" }}
          >
            {isSyncing() ? "..." : "Sync"}
          </Button>
        </div>

        {/* Mini calendar */}
        <MiniCalendar />

        {/* Scrollable sections */}
        <div style={{
          flex: "1",
          "overflow-y": "auto",
          "border-top": "1px solid var(--border-color)",
        }}>
          <CollapsibleSection title="Filtres" defaultOpen={true}>
            <CalendarList />
          </CollapsibleSection>

          <div style={{ height: "1px", background: "var(--border-color)" }} />

          <CollapsibleSection
            title="Contacts"
            defaultOpen={true}
            badge={
              <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                {contacts().length}
              </span>
            }
          >
            <ContactManager />
          </CollapsibleSection>

          <div style={{ height: "1px", background: "var(--border-color)" }} />

          <CollapsibleSection
            title="Taches sans date"
            defaultOpen={false}
            badge={
              <span style={{ "font-size": "10px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "1px 6px", "border-radius": "var(--radius-sm)" }}>
                {unscheduledTasks().length}
              </span>
            }
          >
            <UnscheduledTasks />
          </CollapsibleSection>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
        {/* Header bar */}
        <header style={{
          height: "var(--header-height)",
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "0 16px",
          "border-bottom": "1px solid var(--border-color)",
          "flex-shrink": "0",
        }}>
          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            <Button variant="ghost" onClick={navigatePrev}>&lt;</Button>
            <h1 style={{ "font-size": "18px", "font-weight": "600", "text-transform": "capitalize", "min-width": "180px", "text-align": "center" }}>
              {headerTitle()}
            </h1>
            <Button variant="ghost" onClick={navigateNext}>&gt;</Button>
            <Button variant="secondary" size="sm" onClick={goToToday}>Aujourd'hui</Button>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <Button variant={viewMode() === "month" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("month")}>Mois</Button>
            <Button variant={viewMode() === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>Semaine</Button>
            <Button variant={viewMode() === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>Jour</Button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: "1", overflow: "hidden" }}>
          {props.children}
        </div>
      </main>
    </div>
  );
}
