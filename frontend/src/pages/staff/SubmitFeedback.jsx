import { useEffect, useMemo, useState } from "react";
import {
  HiOutlineCheckCircle,
  HiOutlineClipboardDocumentList,
  HiOutlineDocumentText,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import { EmptyState, StaffWorkspace } from "./StaffWorkspace";
import { formatDateTime } from "./staffWorkspaceUtils";

const STORAGE_KEY = "happy_skin_staff_handover_notes";

export default function SubmitFeedback() {
  const [notes, setNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [form, setForm] = useState({ priority: "normal", message: "" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [notes]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanMessage = form.message.trim();
    if (!cleanMessage) return;
    setNotes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        priority: form.priority,
        message: cleanMessage,
        created_at: new Date().toISOString(),
      },
    ]);
    setForm({ priority: "normal", message: "" });
  };

  const handleDelete = (noteId) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  };

  return (
    <StaffWorkspace title="Staff Handover" eyebrow="Shift notes">
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F7] text-[#D65A9A]">
              <HiOutlineDocumentText className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#1F2937]">Add handover note</h2>
              <p className="text-sm text-[#6B7280]">Use this for local shift reminders until a staff feedback API is added.</p>
            </div>
          </div>

          <label className="mt-5 block text-sm font-bold text-[#1F2937]">
            Priority
            <select
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
              className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="manager">Manager Review</option>
            </select>
          </label>

          <label className="mt-4 block text-sm font-bold text-[#1F2937]">
            Note
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              rows={7}
              placeholder="Example: Customer for booking #42 requested a quieter room."
              className="mt-2 w-full resize-none rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-3 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            />
          </label>

          <button type="submit" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)] transition hover:bg-[#B94B86]">
            <HiOutlinePlus className="h-5 w-5" />
            Save Note
          </button>
        </form>

        <section className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1F2937]">Current notes</h2>
              <p className="text-sm text-[#6B7280]">Stored in this browser for quick shift continuity.</p>
            </div>
            <span className="rounded-full bg-[#FFF0F7] px-3 py-1 text-xs font-bold text-[#C85B95]">{notes.length} notes</span>
          </div>

          {sortedNotes.length ? (
            <div className="space-y-3">
              {sortedNotes.map((note) => <HandoverNote key={note.id} note={note} onDelete={handleDelete} />)}
            </div>
          ) : (
            <EmptyState icon={HiOutlineClipboardDocumentList} title="No handover notes" description="Add reminders, customer preferences, and manager follow-ups for the next staff member." />
          )}
        </section>
      </section>
    </StaffWorkspace>
  );
}

function HandoverNote({ note, onDelete }) {
  const priorityStyles = {
    normal: "bg-[#DCFCE7] text-[#166534]",
    urgent: "bg-[#FEE2E2] text-[#991B1B]",
    manager: "bg-[#DBEAFE] text-[#1D4ED8]",
  };

  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-[#FFF8FB] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold capitalize ${priorityStyles[note.priority] || priorityStyles.normal}`}>
          <HiOutlineCheckCircle className="h-4 w-4" />
          {note.priority?.replace("_", " ")}
        </span>
        <button type="button" onClick={() => onDelete(note.id)} className="rounded-full p-2 text-[#9CA3AF] transition hover:bg-white hover:text-[#B91C1C]" aria-label="Delete handover note">
          <HiOutlineTrash className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#1F2937]">{note.message}</p>
      <p className="mt-3 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(note.created_at)}</p>
    </article>
  );
}
