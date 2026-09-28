import {
  Camera,
  ClipboardList,
  ScanLine,
  Smile,
  Sparkles,
  Monitor,
  Plus,
  Settings,
  Cloud,
  CloudOff,
} from "lucide-react";
import { Case, ThemePreference, WorkflowStep } from "../types";
const steps = [
  { id: "capture", label: "Capture", icon: Camera },
  { id: "assess", label: "Assess", icon: ScanLine },
  { id: "design", label: "Design", icon: Smile },
  { id: "preview", label: "Preview", icon: Sparkles },
  { id: "plan", label: "Plan", icon: ClipboardList },
] as const;
export function WorkflowNav({
  step,
  onChange,
  mobile = false,
}: {
  step: WorkflowStep;
  onChange: (s: WorkflowStep) => void;
  mobile?: boolean;
}) {
  return (
    <nav
      className={
        mobile ? "workflow-nav mobile-nav" : "workflow-nav desktop-nav"
      }
      aria-label="Smile design workflow"
    >
      {steps.map(({ id, label, icon: Icon }, i) => (
        <button
          key={id}
          aria-label={label}
          className={step === id ? "active" : ""}
          onClick={(e) => {
            e.currentTarget.focus();
            onChange(id);
          }}
          aria-current={step === id ? "step" : undefined}
        >
          <Icon size={19} />
          <span>{label}</span>
          <small>{String(i + 1).padStart(2, "0")}</small>
        </button>
      ))}
    </nav>
  );
}
export function Header({
  cases,
  current,
  step,
  onStep,
  onCase,
  onNew,
  theme,
  onTheme,
  saveStatus,
  onSettings,
  onAssistant,
  connected,
}: {
  cases: Case[];
  current: Case;
  step: WorkflowStep;
  onStep: (s: WorkflowStep) => void;
  onCase: (id: string) => void;
  onNew: () => void;
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
  saveStatus: string;
  onSettings: () => void;
  onAssistant: () => void;
  connected: boolean;
}) {
  const approved =
    !!current.treatmentPlan?.approval &&
    current.treatmentPlan.approval.contextVersion === current.contextVersion;
  return (
    <header className="app-header">
      <div className="header-main">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Smile Studio home"
        >
          <span className="brand-mark">
            <Smile size={24} />
          </span>
          <span>
            <strong>
              smile<span className="accent-text">studio</span>
            </strong>
            <small>DIGITAL SMILE DESIGN</small>
          </span>
        </a>
        <div className="case-switch">
          <label className="sr-only" htmlFor="active-patient">
            Active patient
          </label>
          <select
            id="active-patient"
            value={current.id}
            onChange={(e) => onCase(e.target.value)}
          >
            {cases.map((c) => (
              <option value={c.id} key={c.id}>
                {c.patientIdentifier}
                {c.isDemo ? " · Demo" : ""}
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            aria-label="Create patient case"
            onClick={onNew}
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="header-status">
          <span
            className={`status-dot ${saveStatus.includes("failed") ? "warning" : ""}`}
          />
          <span aria-live="polite">{saveStatus}</span>
          <span className="badge">
            {approved ? "Clinician approved" : "Clinical draft"}
          </span>
        </div>
        <div className="header-actions">
          <label className="theme-select">
            <Monitor size={16} />
            <span className="sr-only">Appearance</span>
            <select
              aria-label="Appearance"
              value={theme}
              onChange={(e) => onTheme(e.target.value as ThemePreference)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <button
            className="btn primary assistant-launch"
            aria-label="Assistant"
            onClick={(e) => {
              e.currentTarget.focus();
              onAssistant();
            }}
          >
            <Sparkles size={17} />
            <span>Assistant</span>
          </button>
          <button
            className="icon-btn"
            aria-label="Account and local backup"
            onClick={(e) => {
              e.currentTarget.focus();
              onSettings();
            }}
          >
            {connected ? <Cloud size={20} /> : <CloudOff size={20} />}
          </button>
        </div>
      </div>
      <WorkflowNav step={step} onChange={onStep} />
    </header>
  );
}
