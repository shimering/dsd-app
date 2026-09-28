import { useState } from "react";
import { Loader2, Sparkles, Send, ArrowRight } from "lucide-react";
import {
  AiSuggestion,
  Case,
  ConsultationMessage,
  SuggestionResult,
} from "../../types";
import { hasConsent, isStale, uid } from "../../lib/case-model";
import { requestAi } from "../../lib/gemini";
import { TOOTH_TEMPLATES } from "../../lib/tooth-templates";
import { Dialog, Notice, errorText } from "../ui";
import { ConsentPanel } from "./ConsentPanel";
export function AiSuggestionsModal({
  currentCase,
  onClose,
  onChange,
  onResult,
  onApply,
}: {
  currentCase: Case;
  onClose: () => void;
  onChange: (c: Case) => void;
  onResult: (
    caseId: string,
    data: { suggestions?: SuggestionResult; messages?: ConsultationMessage[] },
  ) => void;
  onApply: (s: AiSuggestion) => void;
}) {
  const [tab, setTab] = useState<"suggestions" | "consultation">("suggestions"),
    [question, setQuestion] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    result = currentCase.suggestions,
    stale = result ? isStale(currentCase, result.provenance) : false;
  async function run() {
    setLoading(true);
    setError("");
    const source = currentCase;
    try {
      const response = await requestAi(source, tab, question);
      if (tab === "suggestions")
        onResult(source.id, { suggestions: response as SuggestionResult });
      else {
        onResult(source.id, {
          messages: [
            { id: uid(), role: "user", text: question },
            {
              id: uid(),
              role: "assistant",
              text: response.answer,
              provenance: response.provenance,
            },
          ],
        });
        setQuestion("");
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog title="Gemini smile assistant" onClose={onClose} wide>
      <div className="stack">
        <div className="row spread">
          <div
            className="inspector-tabs"
            role="group"
            aria-label="Assistant mode"
          >
            <button
              className={tab === "suggestions" ? "active" : ""}
              onClick={() => setTab("suggestions")}
              aria-pressed={tab === "suggestions"}
            >
              Design alternatives
            </button>
            <button
              className={tab === "consultation" ? "active" : ""}
              onClick={() => setTab("consultation")}
              aria-pressed={tab === "consultation"}
            >
              Clinical consultation
            </button>
          </div>
          <span className="badge">Gemini 3.5+ · dentist review</span>
        </div>
        <ConsentPanel currentCase={currentCase} onChange={onChange} />
        <Notice>
          Facial contours inform aesthetic discussion. They do not determine a
          correct tooth form or establish clinical feasibility.
        </Notice>
        {error && <Notice tone="error">{error}</Notice>}
        {tab === "suggestions" ? (
          <>
            <div className="row spread">
              <p className="muted" style={{ fontSize: 13 }}>
                Compare three editable alternatives using the current photo and
                design.
              </p>
              <button
                className="btn primary"
                onClick={() => void run()}
                disabled={loading || !hasConsent(currentCase)}
              >
                <Sparkles size={17} />
                {loading
                  ? "Requesting…"
                  : result
                    ? "Refresh alternatives"
                    : "Request alternatives"}
              </button>
            </div>
            {loading && (
              <div className="loading" role="status">
                <Loader2 className="spin" />
                Requesting Gemini suggestions…
              </div>
            )}
            {stale && (
              <Notice tone="warning">
                These alternatives belong to an earlier case revision. Request
                fresh suggestions before applying.
              </Notice>
            )}
            {result && (
              <>
                <div className="option-grid">
                  {result.suggestions.map((s, i) => (
                    <article className="panel ai-option" key={s.id}>
                      <div className="row spread">
                        <span className="eyebrow">Option {i + 1}</span>
                        <span className="badge">{s.recommendedShade}</span>
                      </div>
                      <svg
                        className="tooth-preview"
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                      >
                        <path
                          d={TOOTH_TEMPLATES[s.toothTemplate].outlinePath(
                            "central",
                            true,
                          )}
                          fill="currentColor"
                          fillOpacity=".15"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                      <h3>{s.styleName}</h3>
                      <span className="badge">{s.toothTemplate}</span>
                      <p>{s.facialProportionRationale}</p>
                      <p>
                        <strong>Smile arc:</strong> {s.smileArcAlignment}
                      </p>
                      <p>
                        <strong>Lip dynamics:</strong> {s.lipLineDynamics}
                      </p>
                      <p>{s.dentitionNotes}</p>
                      <button
                        className="btn primary"
                        disabled={stale}
                        onClick={() => onApply(s)}
                      >
                        Apply upper-ten form
                        <ArrowRight size={15} />
                      </button>
                    </article>
                  ))}
                </div>
                <Notice>{result.perioSummary}</Notice>
                <small className="muted">
                  {result.provenance.model} ·{" "}
                  {new Date(result.provenance.createdAt).toLocaleString()} ·
                  prompt {result.provenance.promptVersion}
                </small>
              </>
            )}
            {!result && !loading && (
              <div className="empty-state">
                <Sparkles size={28} />
                <p>
                  Request alternatives after selecting a patient photo and
                  recording consent.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="stack" aria-live="polite">
              {currentCase.consultation.map((m) => (
                <div className={`chat-message ${m.role}`} key={m.id}>
                  <div className="row spread" style={{ marginBottom: 6 }}>
                    <strong>{m.role === "user" ? "Dentist" : "Gemini"}</strong>
                    {m.provenance && isStale(currentCase, m.provenance) && (
                      <span className="badge warning">Earlier revision</span>
                    )}
                  </div>
                  {m.text}
                </div>
              ))}
            </div>
            <label className="field">
              <span>Ask about this case</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={4000}
                placeholder="What further assessments are needed before considering a gingival margin change?"
              />
            </label>
            <button
              className="btn primary"
              disabled={loading || !question.trim() || !hasConsent(currentCase)}
              onClick={() => void run()}
            >
              {loading ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Send size={18} />
              )}{" "}
              {loading ? "Requesting consultation…" : "Send to Gemini"}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
