/**
 * Follow-up workspace for scheduling, tracking, notes, outcomes, and
 * follow-up-specific dynamic fields.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  MessageSquarePlus,
  PhoneCall,
  Plus,
  Search,
  X,
  Table,
  LayoutList,
  Columns3,
  Check,
} from "lucide-react";
import { api } from "../api.js";
import DynamicFieldsManager, {
  saveDynamicFieldValues,
} from "../components/DynamicFieldsManager.jsx";

// Keep existing browser column preferences compatible with database field keys.
const COLUMN_ALIASES = {
  systemic_therapy: "systemicTherapy",
  severity_score: "severityScore",
  lab_status: "labStatus",
  protocol_week: "protocolWeek",
  treatment_response: "treatmentResponse",
};

/* Column visibility is a per-browser presentation preference only. */
const VISIBILITY_KEY = "littlecare_followup_col_visibility";

/** Restore the user's optional-column preferences from local browser storage. */
function loadVisibility() {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist optional-column preferences without involving clinical data. */
function saveVisibility(visMap) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visMap));
}

/** Normalize MySQL JSON values whether the driver returned an object or text. */
function storedProjectValues(followUp) {
  const raw =
    typeof followUp.custom_values === "string"
      ? JSON.parse(followUp.custom_values || "{}")
      : followUp.custom_values || {};
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      COLUMN_ALIASES[key] || key,
      value,
    ]),
  );
}

/** Format JSON scalar or array values for compact display in the worklist. */
function displayValue(value) {
  if (value == null || value === "") return "Not recorded";
  if (Array.isArray(value))
    return value.length ? value.join(", ") : "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/* ══════════════════════════════════════════════════════════
   Main FollowUps Component
═══════════════════════════════════════════════════════════ */
/** Main follow-up worklist with filters, table/card layouts, and task creation. */
export default function FollowUps() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ users: [], visits: [] });
  const [filters, setFilters] = useState({
    status: "open",
    priority: "all",
    q: "",
  });
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Dual View & Dynamic Schema State
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'cards'
  const [schema, setSchema] = useState([]);
  const [showColPicker, setShowColPicker] = useState(false);

  // Column visibility map
  const [visibility, setVisibility] = useState(() => {
    const saved = loadVisibility();
    if (saved) return saved;
    const initial = {
      patient: true,
      reason: true,
      priority: true,
      assigned: true,
      contact: true,
    };
    initial.treatmentResponse = false;
    return initial;
  });

  const load = () =>
    api(
      `/followups?status=${filters.status}&priority=${filters.priority}&q=${encodeURIComponent(filters.q)}`,
    )
      .then(setItems)
      .catch((e) => setError(e.message));

  const loadSchema = () =>
    api("/dynamic-fields/follow_up")
      .then((data) =>
        setSchema(
          data.fields.map((field) => {
            return {
              key: COLUMN_ALIASES[field.field_key] || field.field_key,
              label: field.label,
            };
          }),
        ),
      )
      .catch((e) => setError(e.message));

  useEffect(() => {
    api("/followups/meta")
      .then(setMeta)
      .catch((e) => setError(e.message));
    loadSchema();
  }, []);

  useEffect(() => {
    load();
  }, [filters.status, filters.priority, filters.q]);

  const metrics = useMemo(
    () => ({
      open: items.filter((x) => !["completed", "cancelled"].includes(x.status))
        .length,
      overdue: items.filter(
        (x) =>
          new Date(x.due_date) < new Date() &&
          !["completed", "cancelled"].includes(x.status),
      ).length,
      high: items.filter((x) => x.priority === "high_risk").length,
      reached: items.filter((x) => x.contact_status === "reached").length,
    }),
    [items],
  );
  const visibleColumns = schema.filter(
    (column) => visibility[column.key] !== false,
  );

  const detail = (id) =>
    api(`/followups/${id}`)
      .then(setSelected)
      .catch((e) => setError(e.message));

  // Toggle single column visibility
  function toggleCol(colKey) {
    const updated = { ...visibility, [colKey]: visibility[colKey] === false };
    setVisibility(updated);
    saveVisibility(updated);
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <section className="toolbar">
        <div>
          <span className="eyebrow">Continuity of care</span>
          <h2>Follow-ups</h2>
          <p>Review due work, record outcomes, and track treatment progress.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* View mode toggle */}
          <div className="view-switch" role="group" aria-label="View switcher">
            <button
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
              title="Clinical Table View"
            >
              <Table size={15} /> Table
            </button>
            <button
              className={viewMode === "cards" ? "active" : ""}
              onClick={() => setViewMode("cards")}
              title="Worklist Card View"
            >
              <LayoutList size={15} /> Cards
            </button>
          </div>

          <button className="button" onClick={() => setCreating(true)}>
            <Plus size={17} /> New Follow-up
          </button>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="stats">
        <Metric
          icon={CalendarClock}
          value={metrics.open}
          label="Open in View"
          tone="blue"
        />
        <Metric
          icon={CalendarClock}
          value={metrics.overdue}
          label="Overdue"
          tone="red"
        />
        <Metric
          icon={PhoneCall}
          value={metrics.high}
          label="High Risk"
          tone="orange"
        />
        <Metric
          icon={CheckCircle2}
          value={metrics.reached}
          label="Patient Reached"
          tone="teal"
        />
      </section>

      {/* ── Main Panel ── */}
      <section className="panel">
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            className="filterbar"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div className="search" style={{ flex: "1 1 280px" }}>
              <Search size={18} color="var(--muted)" />
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Search by patient, MRN, or reason"
              />
            </div>
            <select
              style={{ width: 160 }}
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="open">Open Work</option>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              style={{ width: 160 }}
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
            >
              <option value="all">All Priorities</option>
              <option value="high_risk">High Risk</option>
              <option value="urgent">Urgent</option>
              <option value="routine">Routine</option>
            </select>

            <button
              className="secondary-button"
              onClick={() => setShowColPicker(!showColPicker)}
              aria-expanded={showColPicker}
            >
              <Columns3 size={16} /> Columns
            </button>
          </div>

          {/* Inline Quick Column Visibility Picker */}
          {showColPicker && (
            <div className="col-toggle-panel" style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>
                  Show columns
                </strong>
              </div>
              <div className="col-toggle-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={!!visibility.patient}
                    onChange={() => toggleCol("patient")}
                  />
                  <span>Patient & MRN</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!visibility.reason}
                    onChange={() => toggleCol("reason")}
                  />
                  <span>Reason & Next Action</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!visibility.priority}
                    onChange={() => toggleCol("priority")}
                  />
                  <span>Priority & Due Date</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!visibility.assigned}
                    onChange={() => toggleCol("assigned")}
                  />
                  <span>Assigned Clinician</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!visibility.contact}
                    onChange={() => toggleCol("contact")}
                  />
                  <span>Contact Status</span>
                </label>

                {/* Dynamic & Project Columns */}
                {schema.map((col) => (
                  <label key={col.key}>
                    <input
                      type="checkbox"
                      checked={visibility[col.key] !== false}
                      onChange={() => toggleCol(col.key)}
                    />
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="notice error" style={{ marginTop: 12 }}>
              <X size={16} />
              {error}
            </div>
          )}
        </div>

        {/* ── Table View ── */}
        {viewMode === "table" ? (
          <div className="table-wrap">
            <table aria-label="Follow-up clinical table">
              <thead>
                <tr>
                  {visibility.patient && <th>Patient / MRN</th>}
                  {visibleColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}

                  {visibility.reason && <th>Reason / Action</th>}
                  {visibility.priority && <th>Priority / Due</th>}
                  {visibility.assigned && <th>Assigned To</th>}
                  {visibility.contact && <th>Status</th>}
                  <th style={{ width: 40 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => {
                  const values = storedProjectValues(f);

                  return (
                    <tr
                      key={f.follow_up_id}
                      onClick={() => detail(f.follow_up_id)}
                      tabIndex={0}
                      aria-label={`Open follow-up for ${f.patient_name}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          detail(f.follow_up_id);
                        }
                      }}
                    >
                      {visibility.patient && (
                        <td>
                          <strong>{f.patient_name}</strong>
                          <small>
                            {f.medical_record_number} ·{" "}
                            {f.category.replaceAll("_", " ")}
                          </small>
                        </td>
                      )}
                      {visibleColumns.map((column) => (
                        <td key={column.key}>
                          <span className="clinical-tag custom">
                            {displayValue(values[column.key])}
                          </span>
                        </td>
                      ))}

                      {visibility.reason && (
                        <td style={{ maxWidth: 220 }}>
                          <strong>{f.reason}</strong>
                          <small
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                              maxWidth: 220,
                            }}
                          >
                            {f.next_action || "No action specified"}
                          </small>
                        </td>
                      )}

                      {visibility.priority && (
                        <td>
                          <span className={`pill ${f.priority}`}>
                            {f.priority.replace("_", " ")}
                          </span>
                          <small>
                            Due{" "}
                            {new Date(f.due_date).toLocaleDateString("en-IN")}
                          </small>
                        </td>
                      )}

                      {visibility.assigned && (
                        <td>
                          <strong>{f.assigned_to || "Unassigned"}</strong>
                          <small>{f.contact_status.replaceAll("_", " ")}</small>
                        </td>
                      )}

                      {visibility.contact && (
                        <td>
                          <span className={`pill ${f.status}`}>{f.status}</span>
                        </td>
                      )}

                      <td>
                        <button
                          className="secondary-button"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            detail(f.follow_up_id);
                          }}
                        >
                          Review <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Card Worklist View ── */
          <div className="worklist">
            {items.map((f) => {
              const values = storedProjectValues(f);

              return (
                <button
                  className="work-card"
                  key={f.follow_up_id}
                  onClick={() => detail(f.follow_up_id)}
                >
                  <span className={`priority-rail ${f.priority}`}></span>
                  <div>
                    <strong>{f.patient_name}</strong>
                    <small>
                      {f.medical_record_number} ·{" "}
                      {f.category.replaceAll("_", " ")}
                    </small>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {visibleColumns.map((column) => (
                        <span className="clinical-tag custom" key={column.key}>
                          {column.label}: {displayValue(values[column.key])}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grow">
                    <strong>{f.reason}</strong>
                    <small>
                      {f.next_action || "No next action documented"}
                    </small>
                  </div>
                  <div>
                    <span className={`pill ${f.priority}`}>
                      {f.priority.replace("_", " ")}
                    </span>
                    <small>
                      Due {new Date(f.due_date).toLocaleDateString("en-IN")}
                    </small>
                  </div>
                  <div>
                    <strong>{f.assigned_to || "Unassigned"}</strong>
                    <small>{f.contact_status.replaceAll("_", " ")}</small>
                  </div>
                  <ChevronRight size={18} color="var(--muted)" />
                </button>
              );
            })}
          </div>
        )}

        {!items.length && (
          <p className="empty">No follow-ups match the selected filters.</p>
        )}
      </section>

      {/* ── Follow-up Detail Drawer ── */}
      {selected && (
        <FollowUpDrawer
          data={selected}
          users={meta.users}
          onClose={() => {
            setSelected(null);
            loadSchema();
            load();
          }}
          onChanged={async () => {
            await Promise.all([load(), loadSchema()]);
            setSelected(
              await api(`/followups/${selected.followUp.follow_up_id}`),
            );
          }}
        />
      )}

      {/* ── Create Follow-up Modal ── */}
      {creating && (
        <CreateFollowUp
          meta={meta}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            loadSchema();
            load();
          }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   Follow-up Detail Drawer (Enhanced with Dynamic Fields)
═══════════════════════════════════════════════════════════ */
/** Detailed task panel for assignment, status, notes, outcome, and custom values. */
function FollowUpDrawer({ data, users, onClose, onChanged }) {
  const f = data.followUp;
  const [customValues, setCustomValues] = useState({});

  const [edit, setEdit] = useState({
    status: f.status,
    priority: f.priority,
    assignedUserId: f.assigned_user_id || "",
    contactChannel: f.contact_channel,
    contactStatus: f.contact_status,
    nextAction: f.next_action || "",
    outcome: f.outcome || "",
  });
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("contact_attempt");
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  async function update() {
    try {
      await api(`/followups/${f.follow_up_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...edit,
          assignedUserId: edit.assignedUserId
            ? Number(edit.assignedUserId)
            : null,
        }),
      });
      await saveDynamicFieldValues("follow_up", f.follow_up_id, customValues);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  async function addNote() {
    try {
      await api(`/followups/${f.follow_up_id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          noteType,
          noteText: note,
          contactChannel: edit.contactChannel,
        }),
      });
      setNote("");
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="overlay">
      <div className="drawer wide-drawer">
        <button className="close" onClick={onClose}>
          <X />
        </button>
        <span className="eyebrow">
          {f.medical_record_number} · Follow-up #{f.follow_up_id}
        </span>
        <h2>{f.patient_name}</h2>
        <p style={{ color: "var(--muted)", marginTop: 4 }}>{f.reason}</p>
        {error && <div className="notice error">{error}</div>}
        {savedNotice && (
          <div
            className="notice success"
            style={{
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
            }}
          >
            <Check size={16} /> Follow-up and dynamic project fields saved!
          </div>
        )}

        <div className="detail-grid two">
          <Info
            label="Due Date"
            value={new Date(f.due_date).toLocaleDateString("en-IN")}
          />
          <Info label="Category" value={f.category.replaceAll("_", " ")} />
        </div>

        <DynamicFieldsManager
          context="follow_up"
          recordId={f.follow_up_id}
          values={customValues}
          onValuesChange={setCustomValues}
          title="Clinical tracking"
          description="Additional details for this follow-up."
        />

        <PreviousFollowUps items={data.previous} />

        {/* ── Core Follow-up Work Item ── */}
        <section className="form-section">
          <h3>Work Item</h3>
          <div className="form-grid three">
            <Field label="Status">
              <Select
                value={edit.status}
                set={(v) => setEdit({ ...edit, status: v })}
                items={[
                  "pending",
                  "scheduled",
                  "overdue",
                  "completed",
                  "cancelled",
                ]}
              />
            </Field>
            <Field label="Priority">
              <Select
                value={edit.priority}
                set={(v) => setEdit({ ...edit, priority: v })}
                items={["routine", "urgent", "high_risk"]}
              />
            </Field>
            <Field label="Assigned to">
              <select
                value={edit.assignedUserId}
                onChange={(e) =>
                  setEdit({ ...edit, assignedUserId: e.target.value })
                }
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option value={u.user_id} key={u.user_id}>
                    {u.full_name} · {u.role_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact channel">
              <Select
                value={edit.contactChannel}
                set={(v) => setEdit({ ...edit, contactChannel: v })}
                items={["phone", "sms", "email", "portal", "in_person", "none"]}
              />
            </Field>
            <Field label="Contact status">
              <Select
                value={edit.contactStatus}
                set={(v) => setEdit({ ...edit, contactStatus: v })}
                items={[
                  "not_started",
                  "attempted",
                  "reached",
                  "message_left",
                  "unreachable",
                  "declined",
                ]}
              />
            </Field>
            <Field label="Next action" wide>
              <textarea
                value={edit.nextAction}
                onChange={(e) =>
                  setEdit({ ...edit, nextAction: e.target.value })
                }
              />
            </Field>
            <Field label="Outcome" wide>
              <textarea
                value={edit.outcome}
                onChange={(e) => setEdit({ ...edit, outcome: e.target.value })}
              />
            </Field>
          </div>
          <button className="button" onClick={update}>
            Save changes
          </button>
        </section>

        {/* ── Care Notes ── */}
        <section className="record-section">
          <h3 style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <MessageSquarePlus size={17} /> Add Care Note
          </h3>
          <div className="note-composer">
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
            >
              <option value="contact_attempt">Contact Attempt</option>
              <option value="clinical">Clinical</option>
              <option value="coordination">Care Coordination</option>
              <option value="general">General</option>
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Document clinical discussion, systemic therapy tolerability, lab reviews, or guardian feedback..."
            />
            <button
              className="secondary-button"
              onClick={addNote}
              disabled={!note.trim()}
            >
              Add Note
            </button>
          </div>
        </section>

        {/* ── Activity History ── */}
        <section className="record-section">
          <h3>Activity History</h3>
          {data.notes.length ? (
            data.notes.map((n) => (
              <div className="note" key={n.follow_up_note_id}>
                <strong>{n.note_type.replaceAll("_", " ")}</strong>
                <p>{n.note_text}</p>
                <small>
                  {n.author_name} ·{" "}
                  {new Date(n.created_at).toLocaleString("en-IN")}
                </small>
              </div>
            ))
          ) : (
            <p className="empty compact">No activity recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create Follow-up Modal
═══════════════════════════════════════════════════════════ */
/** Modal form that creates a visit-linked follow-up task. */
function CreateFollowUp({ meta, onClose, onSaved }) {
  const [form, setForm] = useState({
    visitId: meta.visits[0]?.visit_id || "",
    category: "clinical_review",
    priority: "routine",
    dueDate: "",
    reason: "",
    assignedUserId: "",
    contactChannel: "phone",
    nextAction: "",
  });
  const [customValues, setCustomValues] = useState({});

  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!form.visitId) {
      setHistory([]);
      return;
    }
    api(`/followups/history/by-visit/${form.visitId}`)
      .then(setHistory)
      .catch((e) => setError(e.message));
  }, [form.visitId]);

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await api("/followups", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          visitId: Number(form.visitId),
          assignedUserId: form.assignedUserId
            ? Number(form.assignedUserId)
            : null,
        }),
      });
      await saveDynamicFieldValues("follow_up", res.followUpId, customValues);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay center">
      <form className="modal large-modal" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <X />
        </button>
        <span className="eyebrow">Continuity of care</span>
        <h2>New follow-up</h2>
        {error && <div className="notice error">{error}</div>}

        <div className="form-grid">
          <Field label="Patient visit *">
            <select
              value={form.visitId}
              onChange={(e) => set("visitId", e.target.value)}
              required
            >
              {meta.visits.map((v) => (
                <option value={v.visit_id} key={v.visit_id}>
                  {v.patient_name} · {v.medical_record_number} · Visit{" "}
                  {v.visit_id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date *">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              required
            />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              set={(v) => set("category", v)}
              items={[
                "clinical_review",
                "lab_result",
                "medication",
                "immunization",
                "growth_monitoring",
                "referral",
                "care_coordination",
                "other",
              ]}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              set={(v) => set("priority", v)}
              items={["routine", "urgent", "high_risk"]}
            />
          </Field>
          <Field label="Assigned to">
            <select
              value={form.assignedUserId}
              onChange={(e) => set("assignedUserId", e.target.value)}
            >
              <option value="">Unassigned</option>
              {meta.users.map((u) => (
                <option value={u.user_id} key={u.user_id}>
                  {u.full_name} · {u.role_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact channel">
            <Select
              value={form.contactChannel}
              set={(v) => set("contactChannel", v)}
              items={["phone", "sms", "email", "portal", "in_person", "none"]}
            />
          </Field>

          <Field label="Reason *" wide>
            <textarea
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              required
            />
          </Field>
          <Field label="Next action" wide>
            <textarea
              value={form.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
            />
          </Field>
        </div>

        <DynamicFieldsManager
          context="follow_up"
          values={customValues}
          onValuesChange={setCustomValues}
          title="Clinical tracking"
          description="Additional details for this follow-up."
        />

        <PreviousFollowUps items={history} />
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="button">Create Follow-up</button>
        </div>
      </form>
    </div>
  );
}
/* ── Previous Follow-ups Section ── */
/** Show earlier tasks for the same patient to provide continuity of care. */
function PreviousFollowUps({ items = [] }) {
  return (
    <section className="record-section">
      <h3>Previous Follow-ups for this Patient</h3>
      {items.length ? (
        items.map((item) => (
          <div className="clinical-item" key={item.follow_up_id}>
            <div>
              <strong>{item.reason}</strong>
              <small>
                {item.category.replaceAll("_", " ")} · Due{" "}
                {new Date(item.due_date).toLocaleDateString("en-IN")} ·{" "}
                {item.note_count || 0} notes
              </small>
            </div>
            <span className={`pill ${item.status}`}>{item.status}</span>
            {(item.outcome || item.next_action) && (
              <small>{item.outcome || item.next_action}</small>
            )}
          </div>
        ))
      ) : (
        <p className="empty compact">
          No earlier follow-up data for this patient.
        </p>
      )}
    </section>
  );
}

/** Small reusable summary card used above the worklist. */
function Metric({ icon: Icon, value, label, tone = "blue" }) {
  return (
    <article className="stat">
      <span className={`icon ${tone}`}>
        <Icon size={22} />
      </span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

/** Consistent label wrapper shared by follow-up forms. */
function Field({ label, children, wide }) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      {children}
    </label>
  );
}

/** Render enum-like choices while keeping their stored machine values. */
function Select({ value, set, items }) {
  return (
    <select value={value} onChange={(e) => set(e.target.value)}>
      {items.map((x) => (
        <option value={x} key={x}>
          {x.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

/** Read-only label/value pair used inside the detail drawer. */
function Info({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <strong className="capitalize">{value}</strong>
    </div>
  );
}
