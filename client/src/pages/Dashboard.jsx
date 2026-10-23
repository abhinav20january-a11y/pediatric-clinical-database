/** Read-only operational overview for patient, visit, and follow-up activity. */
import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  ClipboardPlus,
  UsersRound,
  AlertCircle,
} from "lucide-react";
import { api } from "../api.js";

const fmt = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

/** Loads and presents the dashboard summary, upcoming bookings, and recent care. */
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="notice error">
        <AlertCircle size={16} />
        The overview could not be loaded. {error}
      </div>
    );
  if (!data) return <div className="loading">Loading clinical overview...</div>;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stats = [
    ["Active Patients", data.counts.patients, UsersRound, "teal"],
    [
      "Today's Appointments",
      data.counts.appointments_today,
      CalendarDays,
      "blue",
    ],
    ["Recorded Visits", data.counts.visits, ClipboardPlus, "violet"],
    ["Open Follow-ups", data.counts.open_followups, CalendarCheck2, "orange"],
  ];

  return (
    <>
      {/* ── Daily overview ── */}
      <section className="welcome">
        <div>
          <span className="eyebrow">{today}</span>
          <h2>Clinical overview</h2>
          <p>Appointments, visits, and follow-up work in one place.</p>
        </div>
        <a className="button" href="#patients">
          Open patient records
        </a>
      </section>

      {/* ── Stats ── */}
      <section className="stats">
        {stats.map(([label, value, Icon, color]) => (
          <article className="stat" key={label}>
            <span className={`icon ${color}`}>
              <Icon size={22} />
            </span>
            <div>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          </article>
        ))}
      </section>

      {/* ── Content grid ── */}
      <div className="grid-2">
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Clinic Flow</span>
              <h3>Upcoming Appointments</h3>
            </div>
            <CalendarDays size={20} color="var(--muted)" />
          </div>
          {data.upcoming.length ? (
            data.upcoming.map((a) => (
              <div className="list-row" key={a.appointment_id}>
                <div className="date-box">
                  <strong>{new Date(a.scheduled_at).getDate()}</strong>
                  <span>
                    {new Date(a.scheduled_at).toLocaleString("en", {
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="grow">
                  <strong>{a.patient_name}</strong>
                  <small>{a.reason}</small>
                </div>
                <div className="right">
                  <span className={`pill ${a.status}`}>
                    {a.status.replace("_", " ")}
                  </span>
                  <small>{fmt(a.scheduled_at)}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="empty">No upcoming appointments.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Longitudinal Record</span>
              <h3>Recent Visits</h3>
            </div>
            <ClipboardPlus size={20} color="var(--muted)" />
          </div>
          <div style={{ padding: "8px 20px" }}>
            <div className="timeline">
              {data.recent.map((v) => (
                <div className="timeline-row" key={v.visit_id}>
                  <span></span>
                  <div>
                    <strong>{v.patient_name}</strong>
                    <p>{v.chief_complaint || "Clinical review"}</p>
                    <small>
                      {v.doctor_name} · {fmt(v.visit_started_at)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
