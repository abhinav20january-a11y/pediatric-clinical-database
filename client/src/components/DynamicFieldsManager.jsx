/**
 * Reusable dynamic-field renderer and schema manager.
 * The `context` prop selects a clinical screen (patient, visit, follow-up,
 * etc.); metadata from the API decides which controls React renders.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ListFilter,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../api.js";

const TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "dropdown",
  "checkbox",
];
const contextNames = {
  patient: "Patient",
  visit: "Visit / encounter",
  prescription: "Prescription",
  lab_order: "Laboratory order",
  allergy: "Allergy",
  immunization: "Immunization",
  follow_up: "Follow-up",
};

/** Save a complete set of custom values for one existing clinical record. */
export async function saveDynamicFieldValues(context, recordId, values) {
  if (!recordId) return;
  await api(`/dynamic-fields/${context}/records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

/**
 * Loads field metadata and current values for one context, renders the correct
 * inputs, and optionally exposes the schema editor used to add or retire fields.
 */
export default function DynamicFieldsManager({
  context,
  recordId = null,
  values: controlledValues,
  onValuesChange,
  title,
  description,
}) {
  const [fields, setFields] = useState([]);
  const [internalValues, setInternalValues] = useState({});
  const [managerOpen, setManagerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const values = controlledValues ?? internalValues;

  async function load(preserveEdits = false) {
    try {
      const data = await api(
        `/dynamic-fields/${context}${recordId ? `?recordId=${recordId}` : ""}`,
      );
      setFields(data.fields);
      if (recordId) {
        const loaded = Object.fromEntries(
          data.fields.map((field) => [
            field.custom_field_id,
            preserveEdits && values[field.custom_field_id] !== undefined
              ? values[field.custom_field_id]
              : (field.value ?? emptyValue(field)),
          ]),
        );
        setInternalValues(loaded);
        onValuesChange?.(loaded);
      }
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [context, recordId]);

  function change(field, value) {
    const updated = { ...values, [field.custom_field_id]: value };
    setInternalValues(updated);
    onValuesChange?.(updated);
  }

  async function saveValues() {
    try {
      await saveDynamicFieldValues(context, recordId, values);
      setMessage("Additional details saved.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  const sections = useMemo(
    () =>
      fields.reduce((all, field) => {
        const section = field.section_name || "Additional information";
        (all[section] ||= []).push(field);
        return all;
      }, {}),
    [fields],
  );

  return (
    <section className="custom-fields-section database-backed-fields">
      <div className="dynamic-fields-title">
        <div>
          <h4>
            <ListFilter size={16} />
            {title || `${contextNames[context]} additional fields`}
          </h4>
          <p>
            {description ||
              "Capture details specific to your clinical workflow."}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setManagerOpen(true)}
        >
          <Settings2 size={14} /> Customize fields
        </button>
      </div>
      {error && (
        <div className="dfm-notice error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {message && (
        <div className="dfm-notice success">
          <Check size={14} />
          {message}
        </div>
      )}
      {!fields.length ? (
        <p className="empty compact">No additional fields have been added.</p>
      ) : (
        Object.entries(sections).map(([section, items]) => (
          <div key={section} className="dynamic-field-section">
            <strong>{section}</strong>
            <div className="form-grid">
              {items.map((field) => (
                <DynamicInput
                  key={field.custom_field_id}
                  field={field}
                  value={values[field.custom_field_id]}
                  onChange={(value) => change(field, value)}
                />
              ))}
            </div>
          </div>
        ))
      )}
      {recordId && !onValuesChange && fields.length > 0 && (
        <button type="button" className="secondary-button" onClick={saveValues}>
          <Save size={14} />
          Save custom values
        </button>
      )}
      {managerOpen && (
        <SchemaManager
          context={context}
          fields={fields}
          editing={editing}
          setEditing={setEditing}
          onReload={() => load(true)}
          onClose={() => {
            setManagerOpen(false);
            setEditing(null);
          }}
          setMessage={setMessage}
        />
      )}
    </section>
  );
}

/** Return a type-safe empty value so every generated input remains controlled. */
function emptyValue(field) {
  if (field.field_type === "boolean") return false;
  if (field.field_type === "checkbox") return [];
  return "";
}

/** Convert database field metadata into the matching native form control. */
function DynamicInput({ field, value, onChange }) {
  const options = Array.isArray(field.options) ? field.options : [];
  const rules = field.validation_rules || {};
  const label = (
    <>
      <span>
        {field.label}
        {field.is_required ? " *" : ""}
      </span>
      {field.help_text && <small>{field.help_text}</small>}
    </>
  );
  if (field.field_type === "textarea")
    return (
      <label className="dynamic-field">
        {label}
        <textarea
          value={value ?? ""}
          maxLength={rules.maxLength}
          required={!!field.is_required}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  if (field.field_type === "dropdown")
    return (
      <label className="dynamic-field">
        {label}
        <select
          value={value ?? ""}
          required={!!field.is_required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose...</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.field_type === "checkbox")
    return (
      <div className="dynamic-field">
        {label}
        <div className="option-grid">
          {options.map((option) => (
            <label className="check" key={option}>
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(option)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...(value || []), option]
                      : (value || []).filter((x) => x !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
      </div>
    );
  if (field.field_type === "boolean")
    return (
      <label className="dynamic-field check">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  return (
    <label className="dynamic-field">
      {label}
      <input
        type={
          field.field_type === "number"
            ? "number"
            : field.field_type === "date"
              ? "date"
              : "text"
        }
        value={value ?? ""}
        min={rules.min}
        max={rules.max}
        maxLength={rules.maxLength}
        required={!!field.is_required}
        onChange={(e) =>
          onChange(
            field.field_type === "number"
              ? e.target.value === ""
                ? ""
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </label>
  );
}

/** Create, edit, order, validate, and retire definitions for one screen context. */
function SchemaManager({
  context,
  fields,
  editing,
  setEditing,
  onReload,
  onClose,
  setMessage,
}) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function begin(field = null) {
    setError("");
    setEditing(field || "new");
    setForm(
      field
        ? {
            key: field.field_key,
            label: field.label,
            type: field.field_type,
            helpText: field.help_text || "",
            sectionName: field.section_name || "Additional information",
            required: !!field.is_required,
            optionsText: (field.options || []).join(", "),
            validationRules: field.validation_rules || {},
            displayOrder: field.display_order,
          }
        : {
            key: "",
            label: "",
            type: "text",
            helpText: "",
            sectionName: "Additional information",
            required: false,
            optionsText: "",
            validationRules: {},
            displayOrder: undefined,
          },
    );
  }
  async function save(event) {
    event.preventDefault();
    if (!form.label.trim() || !form.sectionName.trim()) {
      setError("Enter a label and section.");
      return;
    }
    const options = form.optionsText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (["dropdown", "checkbox"].includes(form.type) && !options.length) {
      setError("Add at least one option.");
      return;
    }
    const body = {
      key: form.key,
      label: form.label,
      type: form.type,
      helpText: form.helpText,
      sectionName: form.sectionName,
      required: form.required,
      options,
      validationRules: form.validationRules,
      displayOrder: form.displayOrder,
    };
    setSaving(true);
    try {
      const path = editing?.custom_field_id
        ? `/dynamic-fields/${context}/${editing.custom_field_id}`
        : `/dynamic-fields/${context}`;
      await api(path, {
        method: editing?.custom_field_id ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      await onReload();
      setEditing(null);
      setForm(null);
      setMessage("Field saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(field) {
    if (
      !confirm(
        `Retire custom field “${field.label}”? Existing values and history will be retained.`,
      )
    )
      return;
    try {
      await api(`/dynamic-fields/${context}/${field.custom_field_id}`, {
        method: "DELETE",
        body: JSON.stringify({
          reason: "Retired by clinician from field manager",
        }),
      });
      await onReload();
      setMessage("Field retired. Previous entries remain in the record.");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="overlay center">
      <div className="modal large-modal dynamic-schema-dialog">
        <button type="button" className="close" onClick={onClose}>
          <X />
        </button>
        <span className="eyebrow">Form settings</span>
        <h2>Customize {contextNames[context].toLowerCase()} fields</h2>
        <p>
          Fields added here are available to the care team. Retired fields
          remain in previous records.
        </p>
        {error && (
          <div className="notice error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {!form && (
          <>
            <div className="schema-list">
              {fields.map((field) => (
                <div className="schema-field-row" key={field.custom_field_id}>
                  <div className="schema-field-info">
                    <strong>{field.label}</strong>
                    <small>
                      {field.field_type} · {field.section_name}
                      {field.is_required ? " · required" : ""}
                    </small>
                  </div>
                  <div className="schema-field-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => begin(field)}
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="secondary-button danger-link"
                      onClick={() => remove(field)}
                    >
                      <Trash2 size={13} />
                      Retire
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="button" onClick={() => begin()}>
              <Plus size={15} />
              Add new field
            </button>
          </>
        )}
        {form && (
          <div>
            <div className="form-grid">
              <label>
                Label *
                <input
                  value={form.label}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      label: e.target.value,
                      key:
                        editing === "new"
                          ? `field_${e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "_")
                              .replace(/^_|_$/g, "")}`
                          : form.key,
                    })
                  }
                  required
                />
              </label>
              <label>
                Data type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <input
                  value={form.sectionName}
                  onChange={(e) =>
                    setForm({ ...form, sectionName: e.target.value })
                  }
                  required
                />
              </label>
              {["dropdown", "checkbox"].includes(form.type) && (
                <label className="wide">
                  Options (comma separated) *
                  <input
                    value={form.optionsText}
                    onChange={(e) =>
                      setForm({ ...form, optionsText: e.target.value })
                    }
                    required
                  />
                </label>
              )}
              <label className="wide">
                Help text
                <input
                  value={form.helpText}
                  onChange={(e) =>
                    setForm({ ...form, helpText: e.target.value })
                  }
                />
              </label>
              <label>
                Minimum
                <input
                  type="number"
                  value={form.validationRules.min ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      validationRules: {
                        ...form.validationRules,
                        min:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  value={form.validationRules.max ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      validationRules: {
                        ...form.validationRules,
                        max:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Max text length
                <input
                  type="number"
                  min="1"
                  value={form.validationRules.maxLength ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      validationRules: {
                        ...form.validationRules,
                        maxLength:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.checked })
                  }
                />
                Required field
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setForm(null);
                  setEditing(null);
                  setError("");
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="button"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save field"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
