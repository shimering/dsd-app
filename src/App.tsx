import React, { useCallback, useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Expand,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  AiSuggestion,
  Case,
  ConsultationMessage,
  GuideKey,
  PhotoAsset,
  SimulationJob,
  SuggestionResult,
  ToothTransform,
  WorkflowStep,
} from "./types";
import { Header, WorkflowNav } from "./components/Header";
import { AccountDialog } from "./components/AccountDialog";
import {
  Dialog,
  Notice,
  errorText,
  useTheme,
  useVisibleViewport,
} from "./components/ui";
import { SmileCanvas, SelectedGuide } from "./components/workspace/SmileCanvas";
import { ToothCustomizer } from "./components/workspace/ToothCustomizer";
import { PeriodontalInspector } from "./components/workspace/PeriodontalInspector";
import { GuideControls } from "./components/workspace/GuideControls";
import { PhotosView, PHOTO_SLOTS } from "./components/workspace/PhotosView";
import { TreatmentPlanView } from "./components/workspace/TreatmentPlanView";
import { AiSuggestionsModal } from "./components/workspace/AiSuggestionsModal";
import { SimulationModal } from "./components/workspace/SimulationModal";
import {
  activePhoto,
  activeRevision,
  createCase,
  invalidate,
  now,
  selectPhoto,
  uid,
  updateDesign,
} from "./lib/case-model";
import { createDemoCase } from "./lib/sample-data";
import { exportDesign } from "./lib/media";
import {
  hydrateCase,
  loadCases,
  saveCases,
  saveMedia,
  stripRuntime,
} from "./lib/storage";
import { loadCloudCases, saveCloudCase, supabase } from "./lib/supabase";
type EditSnapshot = { revisionId: string; photo: PhotoAsset | undefined };
export const App: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]),
    [caseId, setCaseId] = useState(""),
    [step, setStep] = useState<WorkflowStep>("design"),
    [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [refresh, setRefresh] = useState(0),
    [saveStatus, setSaveStatus] = useState("Loading…"),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [selected, setSelected] = useState(11),
    [inspectorTab, setInspectorTab] = useState<"tooth" | "clinical" | "guides">(
      "tooth",
    ),
    [sheetOpen, setSheetOpen] = useState(false),
    [sheetFull, setSheetFull] = useState(false),
    [modal, setModal] = useState<
      "account" | "assistant" | "simulation" | "photos" | null
    >(null),
    [guide, setGuide] = useState<SelectedGuide>("none"),
    [visibleGuides, setVisibleGuides] = useState<GuideKey[]>([
      "facialMidline",
      "smileArc",
    ]),
    [showTeeth, setShowTeeth] = useState(true),
    [opacity, setOpacity] = useState(0.85),
    [showPrevious, setShowPrevious] = useState(false),
    [undo, setUndo] = useState<EditSnapshot[]>([]),
    [redo, setRedo] = useState<EditSnapshot[]>([]);
  const { theme, setTheme } = useTheme();
  useVisibleViewport();
  const savedSnapshots = useRef(new Map<string, string>()),
    scope = useRef("local");
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const owner = session?.user.id ?? "local";
  useEffect(() => {
    let canceled = false;
    setReady(false);
    scope.current = owner;
    setError("");
    savedSnapshots.current.clear();
    void (async () => {
      try {
        let records = await loadCases(owner);
        if (session) {
          try {
            const remote = await loadCloudCases();
            const map = new Map(records.map((c) => [c.id, c]));
            for (const raw of remote) {
              const local = map.get(raw.id);
              if (!local || raw.updatedAt > local.updatedAt)
                map.set(raw.id, await hydrateCase(raw));
            }
            records = [...map.values()];
          } catch (e) {
            if (!canceled) setError(errorText(e));
          }
        }
        if (!records.length) {
          const demo = createDemoCase();
          const source = demo.photos[0],
            blob = await (await fetch(source.url!)).blob();
          source.mediaKey = await saveMedia(blob);
          source.url = URL.createObjectURL(blob);
          if (session) demo.ownerId = session.user.id;
          records = [demo];
        }
        if (!canceled) {
          setCases(records);
          const preference = localStorage.getItem(`dsd_active_${owner}`);
          setCaseId(
            records.some((c) => c.id === preference)
              ? preference!
              : records[0].id,
          );
          setUndo([]);
          setRedo([]);
          setReady(true);
        }
      } catch (e) {
        if (!canceled) {
          setError(errorText(e));
          setSaveStatus("Local storage unavailable");
          setReady(true);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [owner, refresh]);
  useEffect(() => {
    if (!ready || !cases.length) return;
    const sourceScope = owner,
      timer = setTimeout(() => {
        setSaveStatus("Saving locally…");
        void (async () => {
          try {
            await saveCases(cases, sourceScope);
            if (scope.current !== sourceScope) return;
            setSaveStatus("Saved locally");
            if (session) {
              for (const c of cases.filter((c) => !c.isDemo)) {
                const snapshot = JSON.stringify(stripRuntime(c));
                if (savedSnapshots.current.get(c.id) === snapshot) continue;
                await saveCloudCase(c, session.user.id);
                savedSnapshots.current.set(c.id, snapshot);
              }
              if (scope.current === sourceScope)
                setSaveStatus("Synced · media local");
            }
          } catch (e) {
            if (scope.current === sourceScope) {
              setSaveStatus("Cloud/local save failed");
              setError(errorText(e));
            }
          }
        })();
      }, 450);
    return () => clearTimeout(timer);
  }, [cases, ready, owner]);
  useEffect(() => {
    if (caseId) localStorage.setItem(`dsd_active_${owner}`, caseId);
    setUndo([]);
    setRedo([]);
    setSheetFull(false);
  }, [caseId, owner]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const current = cases.find((c) => c.id === caseId) ?? cases[0];
  const changeCase = useCallback((next: Case, clinical = true) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === next.id
          ? {
              ...(clinical
                ? next.contextVersion > c.contextVersion
                  ? next
                  : invalidate(next)
                : next),
              updatedAt: now(),
            }
          : c,
      ),
    );
  }, []);
  function remember(c: Case) {
    setUndo((prev) =>
      [
        ...prev,
        { revisionId: c.activeRevisionId, photo: activePhoto(c) },
      ].slice(-80),
    );
    setRedo([]);
  }
  function editTooth(fdi: number, patch: Partial<ToothTransform>, all = false) {
    if (!current) return;
    remember(current);
    setCases((prev) =>
      prev.map((c) =>
        c.id === current.id
          ? updateDesign(c, (teeth) => {
              for (const id of all ? Object.keys(teeth).map(Number) : [fdi]) {
                const next = { ...teeth[id], ...patch };
                const p = activePhoto(c);
                next.x = Math.max(0, Math.min(p?.width ?? 1000, next.x));
                next.y = Math.max(0, Math.min(p?.height ?? 650, next.y));
                next.widthPx = Math.max(1, next.widthPx);
                next.heightPx = Math.max(1, next.heightPx);
                teeth[id] = next;
              }
              return teeth;
            })
          : c,
      ),
    );
  }
  function editPhoto(patch: Partial<PhotoAsset>) {
    if (!current) return;
    remember(current);
    setCases((prev) =>
      prev.map((c) =>
        c.id === current.id
          ? invalidate({
              ...c,
              photos: c.photos.map((p) =>
                p.id === c.activePhotoId ? { ...p, ...patch } : p,
              ),
            })
          : c,
      ),
    );
  }
  function moveHistory(direction: "undo" | "redo") {
    const stack = direction === "undo" ? undo : redo,
      snapshot = stack.at(-1);
    if (!snapshot || !current) return;
    const reverse = {
      revisionId: current.activeRevisionId,
      photo: activePhoto(current),
    };
    if (direction === "undo") {
      setUndo(stack.slice(0, -1));
      setRedo((prev) => [...prev, reverse]);
    } else {
      setRedo(stack.slice(0, -1));
      setUndo((prev) => [...prev, reverse]);
    }
    setCases((prev) =>
      prev.map((c) =>
        c.id === current.id
          ? invalidate({
              ...c,
              activeRevisionId: snapshot.revisionId,
              photos: c.photos.map((p) =>
                p.id === snapshot.photo?.id ? snapshot.photo : p,
              ),
            })
          : c,
      ),
    );
  }
  function navigate(s: WorkflowStep) {
    setStep(s);
    if (s === "assess") {
      setInspectorTab("clinical");
      setSheetOpen(true);
    }
    if (s === "design") setInspectorTab("tooth");
    if (s === "preview") setModal("simulation");
  }
  function chooseGuide(g: SelectedGuide) {
    setGuide(g);
    setInspectorTab("guides");
    setSheetOpen(true);
    if (g !== "none" && g !== "calibration" && !visibleGuides.includes(g))
      setVisibleGuides((v) => [...v, g]);
  }
  function addResult(
    id: string,
    data: { suggestions?: SuggestionResult; messages?: ConsultationMessage[] },
  ) {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              updatedAt: now(),
              suggestions: data.suggestions ?? c.suggestions,
              consultation: data.messages
                ? [...c.consultation, ...data.messages]
                : c.consultation,
            }
          : c,
      ),
    );
  }
  function applySuggestion(s: AiSuggestion) {
    editTooth(
      selected,
      { form: s.toothTemplate, shade: s.recommendedShade },
      true,
    );
    setModal(null);
    setStep("design");
    setToast("Applied an editable upper-ten design alternative.");
  }
  async function copyLocal() {
    try {
      const records = await loadCases("local");
      setCases((prev) => [
        ...prev,
        ...records
          .filter((c) => !c.isDemo)
          .map((c) => ({
            ...c,
            id: uid(),
            ownerId: session!.user.id,
            consents: [],
            treatmentPlan: c.treatmentPlan
              ? { ...c.treatmentPlan, approval: undefined }
              : undefined,
            contextVersion: c.contextVersion + 1,
            updatedAt: now(),
          })),
      ]);
      setToast(
        "Copied local records into this account; consent and approval require review.",
      );
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (!ready || !current)
    return (
      <div className="empty-state" style={{ height: "100dvh" }}>
        <Loader2 className="spin" />
        <h2>
          {error ? "Workspace could not load" : "Preparing your workspace…"}
        </h2>
        {error && (
          <>
            <Notice tone="error">{error}</Notice>
            <button className="btn" onClick={() => setRefresh((v) => v + 1)}>
              Retry local storage
            </button>
          </>
        )}
      </div>
    );
  const photo = activePhoto(current),
    inspectorContent =
      inspectorTab === "tooth" ? (
        <ToothCustomizer
          currentCase={current}
          presets={[
            ...new Map(
              cases.flatMap((c) => c.presets).map((p) => [p.id, p]),
            ).values(),
          ]}
          selectedFdi={selected}
          onSelect={setSelected}
          onUpdate={(p, all) => editTooth(selected, p, all)}
          onChange={(c) => changeCase(c, false)}
          onAssistant={() => setModal("assistant")}
        />
      ) : inspectorTab === "clinical" ? (
        <PeriodontalInspector
          currentCase={current}
          selectedFdi={selected}
          onSelect={setSelected}
          onChange={changeCase}
        />
      ) : (
        <GuideControls
          key={`${current.id}:${current.activePhotoId}`}
          currentCase={current}
          guide={guide}
          onGuide={chooseGuide}
          onPhoto={editPhoto}
          visible={visibleGuides}
          onVisible={setVisibleGuides}
          showTeeth={showTeeth}
          onShowTeeth={setShowTeeth}
          opacity={opacity}
          onOpacity={setOpacity}
        />
      );
  const photoRail = (
    <>
      <div className="row spread">
        <span className="rail-heading">Patient photographs</span>
        <span className="badge">{current.photos.length}</span>
      </div>
      {current.photos.some((p) => p.archived) && (
        <label className="check">
          <input
            type="checkbox"
            checked={showPrevious}
            onChange={(e) => setShowPrevious(e.target.checked)}
          />
          <span>Show previous photographs</span>
        </label>
      )}
      {current.photos
        .filter((p) => p.type !== "video" && (showPrevious || !p.archived))
        .map((p) => (
          <button
            className={`photo-thumb ${p.id === current.activePhotoId ? "active" : ""}`}
            key={p.id}
            onClick={() => {
              changeCase(selectPhoto(current, p.id));
              setUndo([]);
              setRedo([]);
              setModal(null);
            }}
          >
            {p.url ? (
              <img
                src={p.url}
                alt={
                  PHOTO_SLOTS.find((s) => s.type === p.type)?.label ?? p.name
                }
              />
            ) : (
              <div style={{ padding: 24, fontSize: 12 }}>
                Media not on this device
              </div>
            )}
            <span>
              {PHOTO_SLOTS.find((s) => s.type === p.type)?.label ?? p.name}
              {p.archived ? " · previous" : ""}
            </span>
          </button>
        ))}
      <button
        className="btn block"
        onClick={() => {
          setModal(null);
          setStep("capture");
        }}
      >
        <Camera size={16} />
        Manage photographs
      </button>
      <div className="divider" />
      <span className="rail-heading">Your workspace</span>
      <button
        className="btn block"
        onClick={() => chooseGuide("facialMidline")}
      >
        <SlidersHorizontal size={16} />
        Alignment & guides
      </button>
      <button
        className="btn block"
        onClick={(e) => {
          e.currentTarget.focus();
          setModal("assistant");
        }}
      >
        <Sparkles size={16} />
        Gemini consultation
      </button>
      <div className="rail-note">
        <span className="badge">Upper ten · FDI 15–25</span>
        <p style={{ marginTop: 12 }}>
          Design with the patient. Confirm the clinical findings before
          selecting treatment.
        </p>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <Header
        cases={cases}
        current={current}
        step={step}
        onStep={navigate}
        onCase={setCaseId}
        onNew={() => {
          const c = createCase(
            `PT-${String(cases.filter((c) => !c.isDemo).length + 1).padStart(3, "0")}`,
          );
          c.ownerId = session?.user.id;
          setCases((prev) => [...prev, c]);
          setCaseId(c.id);
          setStep("capture");
        }}
        theme={theme}
        onTheme={setTheme}
        saveStatus={saveStatus}
        onSettings={() => setModal("account")}
        onAssistant={() => setModal("assistant")}
        connected={!!session}
      />
      <main className="app-main">
        {error && (
          <div className="app-error">
            <Notice tone="error">
              <div className="row spread">
                <span>{error}</span>
                <button
                  className="icon-btn"
                  aria-label="Dismiss connection error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            </Notice>
          </div>
        )}
        {step === "capture" ? (
          <PhotosView
            currentCase={current}
            onChange={changeCase}
            onDesign={() => navigate("design")}
            onAddPhoto={(id, asset) =>
              setCases((prev) =>
                prev.map((c) => {
                  if (c.id !== id) return c;
                  const next = {
                    ...c,
                    isDemo: false,
                    photos: [
                      ...c.photos.map((p) =>
                        p.type === asset.type ? { ...p, archived: true } : p,
                      ),
                      asset,
                    ],
                  };
                  return asset.type === "video"
                    ? invalidate(next)
                    : selectPhoto(next, asset.id);
                }),
              )
            }
          />
        ) : step === "plan" ? (
          <TreatmentPlanView
            currentCase={current}
            onChange={(c) => changeCase(c, false)}
          />
        ) : step === "preview" ? (
          <div className="page-scroll">
            <div className="panel empty-state">
              <Sparkles size={36} />
              <h1>Review the patient's simulated smile.</h1>
              <p>
                Generate a patient-specific preview after reviewing the design
                and recording consent.
              </p>
              <button
                className="btn primary"
                onClick={(e) => {
                  e.currentTarget.focus();
                  setModal("simulation");
                }}
              >
                Open simulation workspace
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`workspace ${sheetOpen ? "sheet-open" : ""} ${sheetFull ? "sheet-full" : ""}`}
          >
            <aside
              className="panel tool-rail"
              aria-label="Patient photos and tools"
            >
              {photoRail}
            </aside>
            <div className="canvas-column">
              <div className="canvas-title">
                <div>
                  <span className="eyebrow">
                    {step === "assess"
                      ? "02 / Baseline assessment"
                      : "03 / Smile design"}
                  </span>
                  <h1>
                    {step === "assess"
                      ? "Understand the baseline."
                      : "Make room for a natural smile."}
                  </h1>
                  <p>
                    {current.patientIdentifier} · Revision{" "}
                    {activeRevision(current).revisionNumber}
                  </p>
                </div>
                <div className="row">
                  <button
                    className="btn compact-only"
                    onClick={(e) => {
                      e.currentTarget.focus();
                      setModal("photos");
                    }}
                  >
                    <Camera size={16} />
                    <span>Photos</span>
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Export design blueprint"
                    disabled={!photo?.url}
                    onClick={() =>
                      void exportDesign(
                        photo!,
                        activeRevision(current).teeth,
                      ).catch((e) => setError(errorText(e)))
                    }
                  >
                    <Download size={17} />
                  </button>
                </div>
              </div>
              <SmileCanvas
                currentCase={current}
                selectedFdi={selected}
                onSelectTooth={setSelected}
                onUpdateTooth={(fdi, p) => editTooth(fdi, p)}
                onUpdatePhoto={editPhoto}
                guide={guide}
                onGuide={chooseGuide}
                visibleGuides={visibleGuides}
                showTeeth={showTeeth}
                opacity={opacity}
                onCapture={() => setStep("capture")}
                onUndo={() => moveHistory("undo")}
                onRedo={() => moveHistory("redo")}
                canUndo={undo.length > 0}
                canRedo={redo.length > 0}
              />
            </div>
            <aside
              className={`panel inspector ${sheetOpen ? "open" : ""}`}
              aria-label="Smile editing controls"
            >
              <div className="inspector-header">
                <div>
                  <h2>
                    {inspectorTab === "tooth"
                      ? "Design controls"
                      : inspectorTab === "clinical"
                        ? "Clinical findings"
                        : "Alignment & scale"}
                  </h2>
                  <span className="sheet-summary">
                    FDI {selected} ·{" "}
                    {photo?.calibration.isCalibrated
                      ? "photo scale confirmed"
                      : "photo scale pending"}
                  </span>
                </div>
                <div className="sheet-actions">
                  <button
                    className="icon-btn"
                    aria-label={
                      sheetFull
                        ? "Return to split editing"
                        : "Expand editing panel"
                    }
                    onClick={() => {
                      setSheetOpen(true);
                      setSheetFull((v) => !v);
                    }}
                  >
                    <Expand size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={
                      sheetOpen
                        ? "Collapse editing panel"
                        : "Open editing panel"
                    }
                    aria-expanded={sheetOpen}
                    onClick={() => {
                      setSheetOpen((v) => !v);
                      setSheetFull(false);
                    }}
                  >
                    {sheetOpen ? (
                      <ChevronDown size={19} />
                    ) : (
                      <ChevronUp size={19} />
                    )}
                  </button>
                </div>
              </div>
              <div
                className="inspector-tabs"
                role="group"
                aria-label="Editing section"
              >
                {(["tooth", "clinical", "guides"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={tab === inspectorTab ? "active" : ""}
                    aria-pressed={tab === inspectorTab}
                    onClick={() => {
                      setInspectorTab(tab);
                      setSheetOpen(true);
                    }}
                  >
                    {tab === "tooth"
                      ? "Design"
                      : tab === "clinical"
                        ? "Clinical"
                        : "Guides"}
                  </button>
                ))}
              </div>
              <div className="inspector-body">{inspectorContent}</div>
            </aside>
          </div>
        )}
      </main>
      <WorkflowNav step={step} onChange={navigate} mobile />
      {modal === "account" && (
        <AccountDialog
          cases={cases}
          currentCase={current}
          session={session}
          onClose={() => setModal(null)}
          onCases={(records) => {
            setCases((prev) => [...prev, ...records]);
            if (records[0]) setCaseId(records[0].id);
          }}
          onCaseChange={(c) => changeCase(c, false)}
          onImportLocal={() => void copyLocal()}
          onReload={() => setRefresh((v) => v + 1)}
        />
      )}{" "}
      {modal === "assistant" && (
        <AiSuggestionsModal
          currentCase={current}
          onClose={() => setModal(null)}
          onChange={changeCase}
          onResult={addResult}
          onApply={applySuggestion}
        />
      )}{" "}
      {modal === "simulation" && (
        <SimulationModal
          currentCase={current}
          onClose={() => setModal(null)}
          onChange={changeCase}
          onSave={(id, s) =>
            setCases((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      updatedAt: now(),
                      simulations: [...c.simulations, s],
                    }
                  : c,
              ),
            )
          }
          onReview={(id, status, notes) =>
            setCases((prev) =>
              prev.map((c) =>
                c.id === current.id
                  ? {
                      ...c,
                      updatedAt: now(),
                      simulations: c.simulations.map((s) =>
                        s.id === id ? { ...s, reviewStatus: status, notes } : s,
                      ),
                    }
                  : c,
              ),
            )
          }
        />
      )}{" "}
      {modal === "photos" && (
        <Dialog title="Patient photos & tools" onClose={() => setModal(null)}>
          <div className="stack">{photoRail}</div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
};
export default App;
