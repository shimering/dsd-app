import { useState } from "react";
import { Session } from "@supabase/supabase-js";
import { Download, Upload, LogOut, Loader2 } from "lucide-react";
import { Case } from "../types";
import { Dialog, Notice, errorText } from "./ui";
import { supabase } from "../lib/supabase";
import { exportBackup, importBackup } from "../lib/storage";
import { AiConnectionStatus, checkAiConnection } from "../lib/ai-connection";
export function AccountDialog({
  cases,
  currentCase,
  session,
  onClose,
  onCases,
  onCaseChange,
  onImportLocal,
  onReload,
}: {
  cases: Case[];
  currentCase: Case;
  session: Session | null;
  onClose: () => void;
  onCases: (cases: Case[]) => void;
  onCaseChange: (c: Case) => void;
  onImportLocal: () => void;
  onReload: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [connection, setConnection] = useState<{
      ownerId: string;
      result: AiConnectionStatus;
    } | null>(null);
  const connectionResult =
    connection?.ownerId === session?.user.id ? connection?.result : undefined;
  async function authenticate(signup = false) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const { error } = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage(
        signup
          ? "Account created. Check for a confirmation email if your project requires it."
          : "Signed in. Your account workspace will load.",
      );
      setPassword("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function task(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Patient, account & local backup" onClose={onClose}>
      <div className="stack">
        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <h3>Patient record</h3>
        <label className="field">
          <span>Patient identifier</span>
          <input
            value={currentCase.patientIdentifier}
            onChange={(e) =>
              onCaseChange({
                ...currentCase,
                patientIdentifier: e.target.value,
              })
            }
          />
        </label>
        <label className="field">
          <span>Patient name (optional)</span>
          <input
            value={currentCase.patientName}
            onChange={(e) =>
              onCaseChange({ ...currentCase, patientName: e.target.value })
            }
          />
        </label>
        <p className="muted" style={{ fontSize: 12 }}>
          Patient names and identifiers are omitted from automatic Gemini
          context.
        </p>
        <div className="divider" />
        <h3>Clinician account</h3>
        {session ? (
          <>
            <span className="badge success">
              Signed in · {session.user.email}
            </span>
            <div className="row">
              <button className="btn" onClick={onReload}>
                Reload cloud records
              </button>
              <button className="btn" onClick={onImportLocal}>
                Copy local workspace into this account
              </button>
              <button
                className="btn"
                onClick={() =>
                  void task(async () => {
                    const { error } = await supabase!.auth.signOut();
                    if (error) throw error;
                  })
                }
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </>
        ) : supabase ? (
          <>
            <p className="muted" style={{ fontSize: 13 }}>
              Sign in to sync structured records and request cloud AI. Photos
              and generated images remain on this device.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="row">
              <button
                className="btn primary"
                disabled={busy || !email || password.length < 8}
                onClick={() => void authenticate()}
              >
                {busy ? <Loader2 className="spin" size={16} /> : null}Sign in
              </button>
              <button
                className="btn"
                disabled={busy || !email || password.length < 8}
                onClick={() => void authenticate(true)}
              >
                Create clinician account
              </button>
            </div>
          </>
        ) : (
          <Notice>
            Supabase is not configured. The local workspace remains available.
          </Notice>
        )}
        <div className="divider" />
        <h3>AI connection</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Runs one small text request and checks image-model availability. No
          patient photos or clinical findings are sent.
        </p>
        <button
          className="btn"
          disabled={busy || !session}
          onClick={() =>
            void task(async () => {
              setConnection(null);
              const result = await checkAiConnection();
              setConnection({ ownerId: session!.user.id, result });
            })
          }
        >
          {busy ? <Loader2 className="spin" size={16} /> : null}
          Check AI connection
        </button>
        {!session && (
          <p className="muted" style={{ fontSize: 13 }}>
            Create a clinician account and sign in to check the server key.
          </p>
        )}
        {connectionResult && (
          <div className="stack" aria-live="polite">
            <Notice
              tone={
                connectionResult.text.status === "ready" ? "info" : "warning"
              }
            >
              <strong>
                Text AI:{" "}
                {connectionResult.text.status === "ready"
                  ? "Ready"
                  : "Needs attention"}
              </strong>
              <p>{connectionResult.text.model}</p>
              <p>{connectionResult.text.message}</p>
            </Notice>
            <Notice
              tone={
                connectionResult.image.status === "available"
                  ? "info"
                  : "warning"
              }
            >
              <strong>
                Image AI:{" "}
                {connectionResult.image.status === "available"
                  ? "Available"
                  : "Needs attention"}
              </strong>
              <p>{connectionResult.image.model}</p>
              <p>{connectionResult.image.message}</p>
            </Notice>
            <small className="muted">
              Checked {new Date(connectionResult.checkedAt).toLocaleString()}.
            </small>
          </div>
        )}
        <div className="divider" />
        <h3>Local media backup</h3>
        {cases.some(
          (c) =>
            c.photos.some((p) => p.missing) ||
            c.simulations.some((s) => s.missing),
        ) && (
          <Notice tone="warning">
            Some media are missing on this device. The backup will include only
            locally available files.
          </Notice>
        )}
        <Notice tone="warning">
          This backup includes patient photos, generated images and clinical
          records. Save it to a location controlled by your practice. Browser
          storage can be cleared; media will not follow your account
          automatically.
        </Notice>
        <div className="row">
          <button
            className="btn"
            disabled={busy}
            onClick={() => void task(() => exportBackup(cases))}
          >
            <Download size={16} />
            Export local backup
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void task(() => exportBackup([currentCase]))}
          >
            <Download size={16} />
            Export this patient
          </button>
          <label className="btn">
            <Upload size={16} />
            Import backup
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              aria-label="Import local backup"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void task(async () => {
                    const restored = await importBackup(file, session?.user.id);
                    onCases(restored);
                    setMessage(
                      "Backup restored. Cloud consent and clinical approval require confirmation for imported records.",
                    );
                  });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </Dialog>
  );
}
