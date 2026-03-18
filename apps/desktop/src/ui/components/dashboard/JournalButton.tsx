import { useJournalStore } from "../../../application/stores/journalStore";
import { useNotesStore } from "../../../application/stores/notesStore";
import { useViewStore } from "../../../application/stores/viewStore";
import { Button } from "../common/Button";

export function JournalButton() {
  const { generating, generateJournal } = useJournalStore();
  const { openFile, fetchAll } = useNotesStore();
  const { setViewMode } = useViewStore();

  async function handleClick() {
    try {
      const path = await generateJournal();
      await fetchAll();
      await openFile(path);
      setViewMode("notes");
    } catch (e) {
      console.error("Failed to generate journal:", e);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={generating()}>
      {generating() ? "Generation..." : "Journal du jour"}
    </Button>
  );
}
