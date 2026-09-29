import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  MoreHorizontal,
  Camera,
  ImagePlus,
  Plus,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Cloud,
  Download,
  Upload,
  UserRound,
  Check,
  AlertCircle,
  RotateCcw,
  RotateCw,
  Trash2,
  Sparkles,
  X,
  Copy,
  ShieldCheck,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  STEPS,
  FDI,
  FORMS,
  TEXTURES,
  SHADES,
  DEFAULT_LIGHTING,
  uid,
  now,
  newWorkspace,
  newPhoto,
  activeDesign,
  replaceDesign,
  seededTeeth,
  restoreCrownProportions,
  updatePhoto,
  type Workspace,
  type Photo,
  type Point,
  type Tooth,
  type Tool,
  type Step,
  type Lighting,
} from './domain';
import { lipProblem, clamp, measurementValue, distance } from './geometry';
import { loadToothLibrary } from './assets';
import { Editor, type Selection } from './Editor';
import { ToothReview } from './ToothReview';
import { History } from './history';
import {
  loadMedia,
  saveMedia,
  saveWorkspaces,
  loadWorkspaces,
  exportBackup,
  importBackup,
  download,
  inspectImage,
} from './storage';
import { exportImage, drawMockup } from './render';
import { matchPhotoLighting } from './lighting';
import { supabase, fetchCloud, syncCloud } from './cloud';
import {
  ASSIST_MODEL,
  RENDER_MODEL,
  alignmentSchema,
  landmarkSchema,
  outlineSchema,
  validateProposal,
  type Proposal,
} from './assistProtocol';
import { requestAssistance } from './ai';
import { ProposalPreview } from './ProposalPreview';
import { DsdPanel } from './DsdPanel';
import { dsdDefinition } from './dsdCatalog';
import { applyDsdSuggestion, dsdMeasurement, dsdState } from './dsd';
import { assessmentSchema } from './assistProtocol';

function useImage(key: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false,
      url = '';
    setImage(null);
    if (key)
      loadMedia(key)
        .then(async (blob) => {
          if (!blob) return;
          url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          await img.decode();
          if (!cancelled) setImage(img);
        })
        .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);
  return image;
}
function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          if (e.target.value === '') return;
          const n = Number(e.target.value);
          if (
            Number.isFinite(n) &&
            (!(min !== undefined) || n >= min) &&
            (!(max !== undefined) || n <= max)
          )
            onChange(n);
        }}
      />
    </label>
  );
}
export default function App() {
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(
      () => localStorage.getItem('smile-theme') ?? 'light',
    ),
    [cases, setCases] = useState<Workspace[]>([]),
    [caseId, setCaseId] = useState(''),
    [loaded, setLoaded] = useState(false),
    [step, setStep] = useState<Step>('Photos'),
    [tool, setTool] = useState<Tool>('select'),
    [selection, setSelection] = useState<Selection>(null),
    [fingerEdit, setFingerEdit] = useState(false),
    [group, setGroup] = useState(false),
    [snapping, setSnapping] = useState(
      () => localStorage.getItem('smile-snapping') === 'true',
    ),
    [split, setSplit] = useState(0.5),
    [libraryReady, setLibraryReady] = useState(false),
    [review, setReview] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [saveStatus, setSaveStatus] = useState('Loading local cases…'),
    [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!supabase),
    [account, setAccount] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [authBusy, setAuthBusy] = useState(false),
    [calibration, setCalibration] = useState<Point[] | null>(null),
    [knownLength, setKnownLength] = useState('10'),
    [cloudBusy, setCloudBusy] = useState(false),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [assessmentId, setAssessmentId] = useState<string | null>(null),
    [selectedDsd, setSelectedDsd] = useState<string[]>([]),
    [showAllDsd, setShowAllDsd] = useState(false),
    [aiBusy, setAiBusy] = useState(false),
    [consentDialog, setConsentDialog] = useState(false),
    [consentChecked, setConsentChecked] = useState(false),
    [assistModel, setAssistModel] = useState(ASSIST_MODEL),
    [renderModel, setRenderModel] = useState(RENDER_MODEL);
  const scope = user?.id ?? 'guest',
    histories = useRef(new Map<string, History<Workspace>>()),
    versions = useRef(new Map<string, number>()),
    saveChain = useRef(Promise.resolve()),
    input = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null),
    recoverInput = useRef<HTMLInputElement>(null),
    casesRef = useRef(cases),
    scopeRef = useRef(scope),
    requestToken = useRef(0);
  casesRef.current = cases;
  scopeRef.current = scope;
  const workspace = cases.find((c) => c.id === caseId) ?? cases[0],
    photo =
      workspace?.photos.find((p) => p.id === workspace.activePhotoId) ??
      workspace?.photos[0],
    image = useImage(photo?.mediaKey),
    renderImage = useImage(photo?.render?.mediaKey),
    history = workspace ? histories.current.get(workspace.id) : undefined,
    design = photo ? activeDesign(photo) : undefined;
  const tooth =
    selection?.kind === 'tooth'
      ? design?.teeth.find((t) => t.fdi === selection.fdi)
      : undefined;
  const lighting = design?.lighting ?? DEFAULT_LIGHTING;
  const selectedMeasurement =
    selection?.kind === 'measurement'
      ? photo?.measurements.find((m) => m.id === selection.id)
      : undefined;
  const selectedPoint =
    selection && selection.kind !== 'tooth'
      ? selection.kind === 'lip'
        ? photo?.lip.points[selection.point]
        : selection.kind === 'calibration'
          ? photo?.calibration?.points[selection.point]
          : selectedMeasurement?.points[selection.point]
      : undefined;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('smile-theme', theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('smile-snapping', String(snapping));
  }, [snapping]);
  useEffect(() => {
    loadToothLibrary()
      .then(() => setLibraryReady(true))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (active) {
        setUser(data.session?.user ?? null);
        setAuthReady(true);
        if (authError)
          setNotice('Cloud session unavailable. Local tools remain available.');
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoaded(false);
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    setLoaded(false);
    setCases([]);
    histories.current.clear();
    versions.current.clear();
    setProposal(null);
    requestToken.current++;
    loadWorkspaces(scope)
      .then((local) => {
        if (!active) return;
        const initial = local.length
          ? local
          : [
              {
                ...newWorkspace('My first case'),
                ...(user ? { ownerId: user.id } : {}),
              },
            ];
        setCases(initial);
        setCaseId(initial[0].id);
        setLoaded(true);
        setSaveStatus('Saved on this device');
      })
      .catch((e) => {
        if (active) {
          setError('Local storage could not be opened: ' + e.message);
          setSaveStatus('Local save unavailable');
        }
      });
    return () => {
      active = false;
    };
  }, [scope, authReady]);
  useEffect(() => {
    if (
      !loaded ||
      cases.some((c) => (scope === 'guest' ? !!c.ownerId : c.ownerId !== scope))
    )
      return;
    setSaveStatus('Saving on this device…');
    const snapshot = cases,
      saveScope = scope;
    const timeout = setTimeout(() => {
      saveChain.current = saveChain.current
        .catch(() => {})
        .then(async () => {
          await saveWorkspaces(saveScope, snapshot);
          if (scopeRef.current === saveScope && casesRef.current === snapshot)
            setSaveStatus('Saved on this device');
        })
        .catch((e) => {
          setSaveStatus('Save failed · back up now');
          setError(
            'Local save failed. Export a backup before closing: ' + e.message,
          );
        });
    }, 120);
    return () => clearTimeout(timeout);
  }, [cases, scope, loaded]);
  useEffect(() => {
    setSelection(null);
    setProposal(null);
    setAssessmentId(null);
    requestToken.current++;
    setTool(step === 'Lip outline' ? 'lip' : 'select');
  }, [photo?.id, step]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'z' &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        undo(e.shiftKey);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
  const guard = (work: () => Promise<void>) => {
    setError('');
    void work().catch((e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };
  const commit = (next: Workspace, record = true) => {
    if (!workspace) return;
    const previous =
      casesRef.current.find((c) => c.id === next.id) ?? workspace;
    if (record) {
      let h = histories.current.get(previous.id);
      if (!h) {
        h = new History<Workspace>();
        histories.current.set(previous.id, h);
      }
      h.record(previous);
    }
    casesRef.current = casesRef.current.map((c) =>
      c.id === next.id ? next : c,
    );
    setSaveStatus('Saving on this device…');
    setCases(casesRef.current);
  };
  const edit = (next: Photo) => {
    if (workspace) commit(updatePhoto(workspace, next));
  };
  function undo(redo = false) {
    if (!workspace) return;
    const h = histories.current.get(workspace.id),
      next = redo ? h?.redo(workspace) : h?.undo(workspace);
    if (!next) return;
    next.updatedAt = now();
    next.photos = next.photos.map((p) => ({
      ...p,
      revision:
        Math.max(
          p.revision,
          workspace.photos.find((q) => q.id === p.id)?.revision ?? 0,
        ) + 1,
      render: null,
    }));
    commit(next, false);
    setSelection(null);
  }
  const navigate = (s: Step) => {
    setStep(s);
    setTool(s === 'Lip outline' ? 'lip' : 'select');
    setSelection(null);
    setAssessmentId(null);
  };
  const chooseTool = (t: Tool) => {
    setAssessmentId(null);
    setTool(t);
  };
  const startDsd = (id: string, redraw = false) => {
    if (!photo) return;
    const def = dsdDefinition(id);
    if (!def) return;
    setAssessmentId(id);
    const existing = dsdMeasurement(photo, id);
    setSelection(
      existing && !redraw
        ? { kind: 'measurement', id: existing.id, point: 0 }
        : null,
    );
    setTool(existing && !redraw ? 'select' : def.kind);
  };
  const addPhoto = async (file: File, recover = false) => {
    if (!workspace) throw new Error('Wait for local storage to load.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw new Error(
        'Convert this photo to JPEG, PNG, or WebP first. HEIC, HEIF, RAW, and other formats are not supported.',
      );
    if (file.size > 35 * 1024 * 1024)
      throw new Error('Use a photo under 35 MB.');
    const { width: w, height: h } = await inspectImage(file);
    if (w * h > 64e6 || Math.max(w, h) > 16000)
      throw new Error(
        'Resize this photo to at most 64 megapixels and 16,000 pixels per side before importing.',
      );
    const sha256 = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', await file.arrayBuffer()),
      ),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    if (recover && photo) {
      if (
        w !== photo.width ||
        h !== photo.height ||
        (photo.sha256 && photo.sha256 !== sha256)
      )
        throw new Error(
          'Choose the same original photo. Its dimensions and file fingerprint must match to preserve your geometry.',
        );
      const key = uid();
      await saveMedia(key, file);
      edit({ ...photo, mediaKey: key, sha256 });
      setNotice('Original photo restored. Geometry is preserved.');
      return;
    }
    const key = uid();
    await saveMedia(key, file);
    const p = {
      ...newPhoto(file.name, key, w, h, file.type as Photo['mimeType']),
      sha256,
    };
    const latest = casesRef.current.find((c) => c.id === workspace.id)!;
    commit({
      ...latest,
      updatedAt: now(),
      photos: [...latest.photos, p],
      activePhotoId: p.id,
    });
    navigate('Photos');
  };
  const setPoint = (axis: 'x' | 'y', value: number) => {
    if (!photo || !selection || !selectedPoint || selection.kind === 'tooth')
      return;
    const q = {
      ...selectedPoint,
      [axis]: clamp(value, 0, axis === 'x' ? photo.width : photo.height),
    };
    if (selection.kind === 'lip')
      edit({
        ...photo,
        lip: {
          ...photo.lip,
          closed: false,
          points: photo.lip.points.map((p, i) =>
            i === selection.point ? q : p,
          ),
        },
      });
    if (selection.kind === 'calibration' && photo.calibration) {
      if (distance(q, photo.calibration.points[1 - selection.point]) < 2) {
        setError('Keep calibration endpoints at least two pixels apart.');
        return;
      }
      edit({
        ...photo,
        calibration: {
          ...photo.calibration,
          points: photo.calibration.points.map((p, i) =>
            i === selection.point ? q : p,
          ),
        },
      });
    }
    if (selection.kind === 'measurement')
      edit({
        ...photo,
        measurements: photo.measurements.map((m) =>
          m.id === selection.id
            ? {
                ...m,
                points: m.points.map((p, i) => (i === selection.point ? q : p)),
              }
            : m,
        ),
      });
  };
  const editTooth = (values: Partial<Tooth>) => {
    if (photo && design && tooth)
      edit(
        replaceDesign(photo, {
          ...design,
          teeth: design.teeth.map((t) =>
            group || t.fdi === tooth.fdi ? { ...t, ...values } : t,
          ),
        }),
      );
  };
  const styleTeeth = (key: 'form' | 'texture' | 'shade', value: string) => {
    if (!photo || !design) return;
    edit(
      replaceDesign(photo, {
        ...design,
        teeth: design.teeth.map((t) =>
          !tooth || group || t.fdi === tooth.fdi ? { ...t, [key]: value } : t,
        ),
      }),
    );
  };
  const editLighting = (values: Partial<Lighting>) => {
    if (photo && design)
      edit(
        replaceDesign(
          { ...photo, render: null },
          {
            ...design,
            lighting: { ...lighting, ...values },
          },
        ),
      );
  };
  const matchLighting = () => {
    if (!photo || !image || !design) return;
    setError('');
    try {
      editLighting(matchPhotoLighting(image, photo));
      setNotice(
        'Lighting matched to the original teeth. Refine the controls to suit the photo.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const scaleArch = (factor: number) => {
    if (!photo || !design?.teeth.length) return;
    const center = design.teeth.reduce(
      (a, t) => ({
        x: a.x + t.x / design.teeth.length,
        y: a.y + t.y / design.teeth.length,
      }),
      { x: 0, y: 0 },
    );
    edit(
      replaceDesign(photo, {
        ...design,
        teeth: design.teeth.map((t) => ({
          ...t,
          x: center.x + (t.x - center.x) * factor,
          y: center.y + (t.y - center.y) * factor,
          width: t.width * factor,
          height: t.height * factor,
        })),
      }),
    );
  };
  const sync = async (w = workspace) => {
    if (!w || !user)
      throw new Error('Sign in to sync structured case records.');
    setCloudBusy(true);
    try {
      await saveWorkspaces(scope, casesRef.current);
      await saveChain.current;
      const version = await syncCloud(w, user, versions.current.get(w.id));
      versions.current.set(w.id, version);
      setNotice(
        'Structured records synced. Original photos remain on this device; use a backup to move them.',
      );
    } finally {
      setCloudBusy(false);
    }
  };
  const runAi = async (operation: Proposal['operation']) => {
    if (!workspace || !photo || !image)
      throw new Error('Restore the original photo before requesting AI.');
    if (!user) {
      setAccount(true);
      return;
    }
    if (!workspace.consent) {
      setConsentDialog(true);
      return;
    }
    if (
      operation === 'render' &&
      (!photo.lip.closed || lipProblem(photo.lip) || !design?.teeth.length)
    )
      throw new Error(
        'Confirm the lip outline and place teeth before rendering.',
      );
    const token = ++requestToken.current;
    setAiBusy(true);
    setProposal(null);
    try {
      await sync(workspace);
      let blueprint: { mimeType: 'image/jpeg'; data: string } | undefined;
      if (operation === 'render') {
        const scale = Math.min(1, 1600 / Math.max(photo.width, photo.height)),
          canvas = document.createElement('canvas');
        canvas.width = Math.round(photo.width * scale);
        canvas.height = Math.round(photo.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0, photo.width, photo.height);
        drawMockup(ctx, photo);
        blueprint = {
          mimeType: 'image/jpeg',
          data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1],
        };
      }
      const result = await requestAssistance(
        workspace,
        photo,
        image,
        operation,
        operation === 'render' ? renderModel : assistModel,
        blueprint,
      );
      if (requestToken.current === token) {
        setProposal(result);
        if (result.operation === 'assessment')
          setSelectedDsd(
            assessmentSchema
              .parse(result.result)
              .measurements.filter(
                (m) => !dsdMeasurement(photo, m.assessmentId),
              )
              .map((m) => m.assessmentId),
          );
      }
    } finally {
      setAiBusy(false);
    }
  };
  const applyProposal = async () => {
    if (!workspace || !photo || !proposal) return;
    validateProposal(proposal, {
      workspaceId: workspace.id,
      photoId: photo.id,
      sourceRevision: photo.revision,
    });
    const point = (p: Point) => ({
      x: (p.x * photo.width) / 1000,
      y: (p.y * photo.height) / 1000,
    });
    if (proposal.operation === 'assessment') {
      edit(
        applyDsdSuggestion(
          photo,
          assessmentSchema.parse(proposal.result),
          selectedDsd,
        ),
      );
      setAssessmentId(null);
      setSelection(null);
      setTool('select');
    }
    if (proposal.operation === 'landmarks') {
      const parsed = landmarkSchema.parse(proposal.result);
      edit({
        ...photo,
        measurements: [
          ...photo.measurements,
          ...parsed.measurements.map((m) => ({
            id: uid(),
            kind: 'distance' as const,
            label: m.label,
            points: m.points.map(point),
          })),
        ],
      });
    }
    if (proposal.operation === 'outline') {
      const parsed = outlineSchema.parse(proposal.result);
      const lip = {
        ...photo.lip,
        points: parsed.points.map(point),
        closed: false,
      };
      if (lipProblem(lip))
        throw new Error(
          'The suggested outline intersects or is incomplete. Request a new suggestion or trace it manually.',
        );
      edit({ ...photo, lip });
      navigate('Lip outline');
    }
    if (proposal.operation === 'alignment') {
      const parsed = alignmentSchema.parse(proposal.result);
      const teeth = seededTeeth(photo).map((t) => {
        const suggested = parsed.teeth.find((q) => q.fdi === t.fdi)!;
        return {
          ...t,
          ...point(suggested.center),
          width: (suggested.width * photo.width) / 1000,
          height: (suggested.height * photo.height) / 1000,
          rotation: suggested.rotation,
        };
      });
      edit(replaceDesign(photo, { ...activeDesign(photo), teeth }));
      navigate('Teeth');
    }
    if (proposal.operation === 'render') {
      const result = proposal.result as { mimeType: string; data: string };
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(result.mimeType) ||
        typeof result.data !== 'string' ||
        result.data.length > 22e6
      )
        throw new Error('The AI image response was rejected.');
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0)),
        blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        if (
          Math.abs(
            img.naturalWidth /
              img.naturalHeight /
              (photo.width / photo.height) -
              1,
          ) > 0.03
        )
          throw new Error(
            'The AI image changed the photo framing. It was rejected; editable teeth are preserved.',
          );
      } finally {
        URL.revokeObjectURL(url);
      }
      const key = uid();
      await saveMedia(key, blob);
      edit({
        ...photo,
        render: {
          mediaKey: key,
          sourceRevision: photo.revision + 1,
          model: proposal.model,
          createdAt: now(),
        },
      });
      navigate('Compare');
    }
    setProposal(null);
  };
  const projected = photo?.calibration
    ? 'Projected millimeters'
    : 'Pixels · uncalibrated';
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">s</span>
          <span>
            smile<span className="brand-light">studio</span>
            <small>DESIGN WITH INTENTION</small>
          </span>
        </a>
        <div className="header-case">
          <select
            aria-label="Current case"
            value={workspace?.id ?? ''}
            onChange={(e) => {
              setCaseId(e.target.value);
              navigate('Photos');
            }}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            aria-label="New case"
            onClick={() => {
              const c = {
                ...newWorkspace(),
                ...(user ? { ownerId: user.id } : {}),
              };
              setCases([...cases, c]);
              setCaseId(c.id);
              navigate('Photos');
            }}
            disabled={!loaded}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="header-actions">
          <span
            className={
              'save-status ' +
              (saveStatus.startsWith('Save failed') ? 'failed' : '')
            }
            aria-live="polite"
          >
            <span className="status-dot" />
            {saveStatus}
          </span>
          <button
            title="Backup and import"
            aria-label="Export backup"
            onClick={() =>
              guard(async () => {
                await exportBackup(workspace ? [workspace] : []);
              })
            }
          >
            <Download size={18} />
          </button>
          <button
            aria-label="Import backup"
            title="Import backup"
            onClick={() => backupInput.current?.click()}
          >
            <Upload size={18} />
          </button>
          <button
            aria-label="Switch theme"
            title="Switch theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <button
            className="more-actions"
            aria-label="More workspace actions"
            onClick={() => setMenu(true)}
          >
            <MoreHorizontal size={19} />
          </button>
          <button
            aria-label={user ? 'Account' : 'Sign in'}
            className="account-button"
            onClick={() => setAccount(true)}
          >
            <UserRound size={17} />
            <span>{user ? 'Account' : 'Sign in'}</span>
          </button>
        </div>
      </header>
      <nav className="step-nav" aria-label="Smile design workflow">
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={step === s ? 'current' : ''}
            onClick={() => navigate(s)}
          >
            <span className="step-number">{i + 1}</span>
            <span>{s}</span>
            {i < 4 && <ChevronDown className="step-chevron" size={14} />}
          </button>
        ))}
      </nav>
      {(error || notice) && (
        <div
          className={'message-bar ' + (error ? 'error' : '')}
          role={error ? 'alert' : 'status'}
        >
          {error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{error || notice}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <main className="workspace-layout">
        <section className="work-area">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">
                {workspace?.name ?? 'YOUR WORKSPACE'}
              </span>
              <h1>
                {step === 'Photos'
                  ? 'Start with a smile.'
                  : step === 'Measure'
                    ? 'Every detail, considered.'
                    : step === 'Lip outline'
                      ? 'Follow the natural opening.'
                      : step === 'Teeth'
                        ? 'Shape your vision.'
                        : 'See the possibility.'}
              </h1>
            </div>
            <button className="subtle" onClick={() => setReview(true)}>
              <Layers size={17} />
              Tooth library
            </button>
          </div>
          {photo ? (
            <Editor
              photo={photo}
              image={image}
              renderImage={renderImage}
              step={step}
              tool={tool}
              onTool={chooseTool}
              assessmentId={assessmentId}
              showAllDsd={showAllDsd}
              onChange={edit}
              selection={selection}
              onSelect={setSelection}
              onCalibrate={setCalibration}
              fingerEdit={fingerEdit}
              group={group}
              snapping={snapping}
              libraryReady={libraryReady}
              split={split}
              onSplit={setSplit}
              onUndo={() => undo()}
              onRedo={() => undo(true)}
              canUndo={history?.canUndo ?? false}
              canRedo={history?.canRedo ?? false}
            />
          ) : (
            <div className="empty-canvas">
              <div className="empty-decoration">
                <ImagePlus size={42} strokeWidth={1} />
              </div>
              <span className="eyebrow">A FRESH PERSPECTIVE</span>
              <h2>Your next smile begins here.</h2>
              <p>
                Add a frontal smile photo to start.
                <br />
                Your original stays safely on this device.
              </p>
              <button
                className="primary"
                disabled={!loaded}
                onClick={() => input.current?.click()}
              >
                <ImagePlus size={18} />
                Choose a photo
              </button>
              <button className="text-button" onClick={() => setReview(true)}>
                Explore the tooth library <ArrowRight size={15} />
              </button>
              <div className="empty-form-preview">
                <span>PHOTOS</span>
                <i />
                <span>MEASURE</span>
                <i />
                <span>DESIGN</span>
                <i />
                <span>COMPARE</span>
              </div>
            </div>
          )}
          <div className="photo-strip">
            {workspace?.photos.map((p) => (
              <button
                key={p.id}
                className={
                  'photo-chip ' + (p.id === photo?.id ? 'selected' : '')
                }
                onClick={() => {
                  commit({ ...workspace, activePhotoId: p.id }, false);
                  setSelection(null);
                }}
              >
                <PhotoThumb mediaKey={p.mediaKey} />
                <span>{p.name}</span>
              </button>
            ))}
            <button
              className="add-photo-chip"
              disabled={!loaded}
              onClick={() => input.current?.click()}
            >
              <Plus size={18} />
              <span>Add photo</span>
            </button>
          </div>
          <div className="step-bottom">
            <span>
              <ShieldCheck size={15} /> Original preserved · Local media
            </span>
            <div>
              {STEPS.indexOf(step) > 0 && (
                <button
                  className="subtle"
                  onClick={() => navigate(STEPS[STEPS.indexOf(step) - 1])}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              {step !== 'Compare' && (
                <button
                  className="primary"
                  disabled={!photo}
                  onClick={() => navigate(STEPS[STEPS.indexOf(step) + 1])}
                >
                  Continue to {STEPS[STEPS.indexOf(step) + 1]}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-title">
            <span className="eyebrow">
              {step === 'Photos'
                ? 'PHOTO WORKSPACE'
                : step === 'Measure'
                  ? 'PRECISION TOOLS'
                  : step === 'Lip outline'
                    ? 'LIP OPENING'
                    : step === 'Teeth'
                      ? 'TOOTH DESIGN'
                      : 'BEFORE & AFTER'}
            </span>
            <span className="stage-counter">
              0{STEPS.indexOf(step) + 1} / 05
            </span>
          </div>
          {step === 'Photos' && (
            <>
              <h2>The original matters.</h2>
              <p className="muted">
                Use a clear frontal photo with the full smile visible. Add more
                views whenever you need them.
              </p>
              <label className="field">
                Case name
                <input
                  maxLength={120}
                  value={workspace?.name ?? ''}
                  onChange={(e) =>
                    workspace &&
                    commit(
                      {
                        ...workspace,
                        name: e.target.value || 'Untitled case',
                        updatedAt: now(),
                      },
                      false,
                    )
                  }
                />
              </label>
              <button
                className="primary full"
                disabled={!loaded}
                onClick={() => input.current?.click()}
              >
                <ImagePlus size={18} />
                Photo library
              </button>
              <button
                className="full"
                disabled={!loaded}
                onClick={() => camera.current?.click()}
              >
                <Camera size={18} />
                Take a photo
              </button>
              <div className="note">
                JPEG, PNG, WebP · up to 35 MB
                <br />
                Convert HEIC or RAW before importing.
              </div>
              {photo && (
                <>
                  <hr />
                  <label className="field">
                    Photo name
                    <input
                      value={photo.name}
                      maxLength={500}
                      onChange={(e) => edit({ ...photo, name: e.target.value })}
                    />
                  </label>
                  <div className="rotation-buttons">
                    <button
                      onClick={() =>
                        edit({ ...photo, rotation: photo.rotation - 90 })
                      }
                    >
                      <RotateCcw size={17} />
                      −90°
                    </button>
                    <button
                      onClick={() =>
                        edit({ ...photo, rotation: photo.rotation + 90 })
                      }
                    >
                      <RotateCw size={17} />
                      +90°
                    </button>
                  </div>
                  <Field
                    label="Rotation °"
                    value={photo.rotation}
                    step={0.5}
                    onChange={(rotation) => edit({ ...photo, rotation })}
                  />
                  <p className="note">
                    Rotation changes your view. Your original photo and
                    measurement coordinates stay intact.
                  </p>
                </>
              )}
            </>
          )}
          {step === 'Measure' && photo && (
            <>
              <h2>Assess tooth positioning.</h2>
              <p className="muted">
                Choose a tool above the photo. Every point can be moved and
                adjusted precisely.
              </p>
              <div
                className={
                  'calibration-card ' + (photo.calibration ? 'confirmed' : '')
                }
              >
                <CrosshairIcon />
                <div>
                  <strong>{projected}</strong>
                  <small>
                    {photo.calibration
                      ? `Reference: ${photo.calibration.lengthMm} mm`
                      : 'Set a known reference to show millimeters.'}
                  </small>
                </div>
              </div>
              <button className="full" onClick={() => chooseTool('calibrate')}>
                {photo.calibration
                  ? 'Recalibrate photo'
                  : 'Calibrate this photo'}
              </button>
              {photo.calibration && (
                <button
                  className="text-button"
                  onClick={() => edit({ ...photo, calibration: null })}
                >
                  Clear calibration
                </button>
              )}
              <div className="note">
                Millimeters are projected from a 2D photo. Confirm the reference
                in the same plane as your measurement.
              </div>
              <hr />
              <DsdPanel
                photo={photo}
                assessmentId={assessmentId}
                onStart={startDsd}
                showAll={showAllDsd}
                onShowAll={setShowAllDsd}
                onAssist={() => guard(() => runAi('assessment'))}
                aiBusy={aiBusy}
                imageReady={!!image}
                onChange={(next) => {
                  if (dsdState(next).view !== dsdState(photo).view) {
                    setAssessmentId(null);
                    setSelection(null);
                    setTool('select');
                  }
                  edit(next);
                }}
              />
              <hr />
              <div className="section-label">
                MEASUREMENTS <span>{photo.measurements.length}</span>
              </div>
              {photo.measurements.length === 0 ? (
                <p className="muted">Your measurements will appear here.</p>
              ) : (
                <div className="measurement-list">
                  {photo.measurements.map((m) => (
                    <button
                      key={m.id}
                      className={
                        selection?.kind === 'measurement' &&
                        selection.id === m.id
                          ? 'selected'
                          : ''
                      }
                      onClick={() => {
                        setAssessmentId(m.assessmentId ?? null);
                        setSelection({
                          kind: 'measurement',
                          id: m.id,
                          point: 0,
                        });
                        setTool('select');
                      }}
                    >
                      <span>{m.label}</span>
                      <strong>{measurementValue(m, photo)}</strong>
                    </button>
                  ))}
                </div>
              )}
              {selectedMeasurement && (
                <>
                  <label className="field">
                    Measurement label
                    <input
                      maxLength={200}
                      value={selectedMeasurement.label}
                      onChange={(e) =>
                        edit({
                          ...photo,
                          measurements: photo.measurements.map((m) =>
                            m.id === selectedMeasurement.id
                              ? { ...m, label: e.target.value }
                              : m,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    className="danger full"
                    onClick={() => {
                      edit({
                        ...photo,
                        measurements: photo.measurements.filter(
                          (m) => m.id !== selectedMeasurement.id,
                        ),
                      });
                      setSelection(null);
                    }}
                  >
                    <Trash2 size={16} />
                    Delete measurement
                  </button>
                </>
              )}
            </>
          )}
          {step === 'Lip outline' && photo && (
            <>
              <h2>Point by point.</h2>
              <p className="muted">
                Trace the inner upper lip, then return along the lower lip to
                form one closed opening.
              </p>
              <div className="outline-status">
                <span
                  className={'status-dot ' + (photo.lip.closed ? '' : 'draft')}
                />
                <strong>
                  {photo.lip.closed ? 'Outline confirmed' : 'Editable draft'}
                </strong>
                <small>{photo.lip.points.length} points</small>
              </div>
              <button
                className="primary full"
                disabled={!!lipProblem(photo.lip) || photo.lip.closed}
                onClick={() =>
                  edit({ ...photo, lip: { ...photo.lip, closed: true } })
                }
              >
                <Check size={17} />
                Confirm outline
              </button>
              {!photo.lip.closed && (
                <div className="note">
                  {lipProblem(photo.lip) ??
                    'Ready to confirm. Teeth will be clipped behind the lips.'}
                </div>
              )}
              {photo.lip.closed && (
                <button
                  className="full"
                  onClick={() =>
                    edit({ ...photo, lip: { ...photo.lip, closed: false } })
                  }
                >
                  Edit outline
                </button>
              )}
              <label className="field">
                Smoothing · {Math.round(photo.lip.smoothing * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={photo.lip.smoothing}
                  onChange={(e) =>
                    edit({
                      ...photo,
                      lip: { ...photo.lip, smoothing: Number(e.target.value) },
                    })
                  }
                />
              </label>
              {selection?.kind === 'lip' && (
                <div className="button-row">
                  <button
                    onClick={() => {
                      const points = [...photo.lip.points],
                        i = selection.point,
                        a = points[i],
                        b = points[(i + 1) % points.length];
                      points.splice(i + 1, 0, {
                        x: (a.x + b.x) / 2,
                        y: (a.y + b.y) / 2,
                      });
                      edit({
                        ...photo,
                        lip: { ...photo.lip, closed: false, points },
                      });
                      setSelection({ kind: 'lip', point: i + 1 });
                    }}
                  >
                    <Plus size={16} />
                    Insert after
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      edit({
                        ...photo,
                        lip: {
                          ...photo.lip,
                          closed: false,
                          points: photo.lip.points.filter(
                            (_, i) => i !== selection.point,
                          ),
                        },
                      });
                      setSelection(null);
                    }}
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                </div>
              )}
              <button
                className="text-button"
                onClick={() => {
                  edit({
                    ...photo,
                    lip: { ...photo.lip, points: [], closed: false },
                  });
                  setSelection(null);
                }}
              >
                Start outline again
              </button>
            </>
          )}
          {step === 'Teeth' && photo && design && (
            <>
              <h2>A smile of your own.</h2>
              <p className="muted">
                Start with the upper arch, then refine each tooth. Rounded
                cervical contours are included in every form.
              </p>
              {!design.teeth.length ? (
                <button
                  className="primary full"
                  disabled={!libraryReady}
                  onClick={() =>
                    edit(
                      replaceDesign(photo, {
                        ...design,
                        teeth: seededTeeth(photo),
                        lighting: {
                          ...DEFAULT_LIGHTING,
                          highlights: 25,
                          lipShadow: 20,
                          posteriorShadow: 15,
                        },
                      }),
                    )
                  }
                >
                  <Plus size={17} />
                  Place ten upper teeth
                </button>
              ) : (
                <>
                  <div className="fdi-grid">
                    {FDI.map((fdi) => (
                      <button
                        key={fdi}
                        className={tooth?.fdi === fdi ? 'selected' : ''}
                        onClick={() => {
                          setSelection({ kind: 'tooth', fdi });
                          setTool('select');
                        }}
                      >
                        {fdi}
                      </button>
                    ))}
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={group}
                      onChange={(e) => setGroup(e.target.checked)}
                    />
                    Move and style the whole smile
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={snapping}
                      onChange={(e) => setSnapping(e.target.checked)}
                    />
                    Apply snapping
                  </label>
                  <div className="note">
                    Pinch to scale and twist to rotate. Snapping attracts nearby
                    5° angles and 5% scale steps. Choose Pan to move the photo.
                  </div>
                  <div className="section-label">
                    {tooth && !group ? `TOOTH ${tooth.fdi}` : 'WHOLE SMILE'}
                  </div>
                  <label className="field">
                    Form
                    <select
                      aria-label="Form"
                      value={tooth?.form ?? design.teeth[0].form}
                      onChange={(e) => styleTeeth('form', e.target.value)}
                    >
                      {FORMS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Texture
                    <select
                      aria-label="Texture"
                      value={tooth?.texture ?? design.teeth[0].texture}
                      onChange={(e) => styleTeeth('texture', e.target.value)}
                    >
                      {TEXTURES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <div className="field">
                    Visual shade
                    <div className="shade-options">
                      {SHADES.map((shade) => (
                        <button
                          key={shade}
                          className={
                            (tooth?.shade ?? design.teeth[0].shade) === shade
                              ? 'selected'
                              : ''
                          }
                          onClick={() => styleTeeth('shade', shade)}
                        >
                          <i className={'shade-' + shade} />
                          {shade}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="note">
                    Shade names express a visual preference in this simulation.
                  </div>
                  <button
                    className="full"
                    onClick={() =>
                      edit(
                        replaceDesign(photo, {
                          ...design,
                          teeth: design.teeth.map((t) =>
                            !tooth || group || t.fdi === tooth.fdi
                              ? restoreCrownProportions(t)
                              : t,
                          ),
                        }),
                      )
                    }
                  >
                    Restore natural proportions
                  </button>
                  <div className="note">
                    Shorten elongated crowns using their width. Applies to
                    {tooth && !group
                      ? ` tooth ${tooth.fdi}`
                      : ' the whole smile'}
                    . Fine-tune width and height for the individual case.
                  </div>
                  {group ? (
                    <div className="button-row">
                      <button onClick={() => scaleArch(0.95)}>Scale −5%</button>
                      <button onClick={() => scaleArch(1.05)}>Scale +5%</button>
                    </div>
                  ) : (
                    tooth && (
                      <>
                        <div className="numeric-grid">
                          <Field
                            label="Center X"
                            value={tooth.x}
                            onChange={(x) => editTooth({ x })}
                          />
                          <Field
                            label="Center Y"
                            value={tooth.y}
                            onChange={(y) => editTooth({ y })}
                          />
                          <Field
                            label="Width px"
                            value={tooth.width}
                            min={1}
                            max={photo.width * 2}
                            onChange={(width) => editTooth({ width })}
                          />
                          <Field
                            label="Height px"
                            value={tooth.height}
                            min={1}
                            max={photo.height * 2}
                            onChange={(height) => editTooth({ height })}
                          />
                        </div>
                        <Field
                          label="Tooth rotation °"
                          value={tooth.rotation}
                          step={0.5}
                          onChange={(rotation) => editTooth({ rotation })}
                        />
                        <label className="field">
                          Perspective
                          <input
                            type="range"
                            min="-.65"
                            max=".65"
                            step=".01"
                            value={tooth.perspective}
                            onChange={(e) =>
                              editTooth({ perspective: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={tooth.visible}
                            onChange={(e) =>
                              editTooth({ visible: e.target.checked })
                            }
                          />
                          Show tooth {tooth.fdi}
                        </label>
                      </>
                    )
                  )}
                  <details className="lighting-panel" open>
                    <summary>Lighting &amp; shadows</summary>
                    <p className="muted">
                      Adjust the whole smile to suit the photograph.
                    </p>
                    <div className="button-row">
                      <button
                        onClick={matchLighting}
                        disabled={
                          !image ||
                          !libraryReady ||
                          !photo.lip.closed ||
                          !!lipProblem(photo.lip)
                        }
                      >
                        <Sun size={16} /> Match photo
                      </button>
                      <button onClick={() => editLighting(DEFAULT_LIGHTING)}>
                        Reset lighting
                      </button>
                    </div>
                    {(
                      [
                        ['brightness', 'Brightness', -40, 40],
                        ['warmth', 'Warmth', -40, 40],
                        ['saturation', 'Saturation', -50, 50],
                        ['highlights', 'Soften highlights', 0, 100],
                        ['lipShadow', 'Upper lip shadow', 0, 75],
                        ['shadowDepth', 'Shadow reach', 10, 80],
                        ['posteriorShadow', 'Posterior shadow', 0, 75],
                        [
                          'lightBalance',
                          'Light balance · left / right',
                          -60,
                          60,
                        ],
                      ] as const
                    ).map(([key, label, min, max]) => (
                      <label className="field lighting-field" key={key}>
                        <span>
                          {label}
                          <span className="lighting-value" aria-hidden="true">
                            {lighting[key]}
                          </span>
                        </span>
                        <input
                          type="range"
                          aria-label={label}
                          min={min}
                          max={max}
                          step="1"
                          value={lighting[key]}
                          onChange={(e) =>
                            editLighting({ [key]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ))}
                    <div className="note">
                      Match photo gives starting values from the original teeth.
                      Refine them with the sliders.
                    </div>
                  </details>
                  <hr />
                  <label className="field">
                    Alternative design
                    <select
                      aria-label="Alternative design"
                      value={design.id}
                      onChange={(e) => {
                        edit({ ...photo, activeDesignId: e.target.value });
                        setSelection(null);
                      }}
                    >
                      {photo.designs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Design name
                    <input
                      maxLength={120}
                      value={design.name}
                      onChange={(e) =>
                        edit(
                          replaceDesign(photo, {
                            ...design,
                            name: e.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                  <button
                    className="full"
                    onClick={() => {
                      const d = {
                        ...structuredClone(design),
                        id: uid(),
                        name: 'Design ' + (photo.designs.length + 1),
                        createdAt: now(),
                      };
                      edit({
                        ...photo,
                        designs: [...photo.designs, d],
                        activeDesignId: d.id,
                      });
                    }}
                  >
                    <Copy size={16} />
                    Duplicate alternative
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      commit({
                        ...workspace,
                        presets: [
                          ...workspace.presets,
                          {
                            id: uid(),
                            name: design.name,
                            design: structuredClone(design),
                            sourceWidth: photo.width,
                            sourceHeight: photo.height,
                          },
                        ],
                        updatedAt: now(),
                      });
                      setNotice(
                        'Reusable preset saved in this case. Include it in a backup to move it.',
                      );
                    }}
                  >
                    Save reusable preset
                  </button>
                  {workspace.presets.length > 0 && (
                    <label className="field">
                      Apply a preset
                      <select
                        aria-label="Apply a preset"
                        value=""
                        onChange={(e) => {
                          const preset = workspace.presets.find(
                            (p) => p.id === e.target.value,
                          );
                          if (preset)
                            edit(
                              replaceDesign(photo, {
                                ...design,
                                teeth: preset.design.teeth.map((t) => ({
                                  ...t,
                                  x: (t.x * photo.width) / preset.sourceWidth,
                                  y: (t.y * photo.height) / preset.sourceHeight,
                                  width:
                                    (t.width * photo.width) /
                                    preset.sourceWidth,
                                  height:
                                    (t.height * photo.height) /
                                    preset.sourceHeight,
                                })),
                              }),
                            );
                        }}
                      >
                        <option value="">Choose preset…</option>
                        {workspace.presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {(!photo.lip.closed || lipProblem(photo.lip)) && (
                <div className="note warning">
                  Confirm your lip outline to see teeth behind the lips and
                  enable exports.
                </div>
              )}
            </>
          )}
          {step === 'Compare' && photo && (
            <>
              <h2>Imagine the change.</h2>
              <p className="muted">
                The same photo and framing on both sides. The original outside
                the lip outline is preserved.
              </p>
              <label className="field">
                Comparison position
                <input
                  aria-label="Comparison position"
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={split}
                  onChange={(e) => setSplit(Number(e.target.value))}
                />
              </label>
              {(!photo.lip.closed ||
                lipProblem(photo.lip) ||
                !design?.teeth.length) && (
                <div className="note warning">
                  Confirm the lip outline and place teeth to create a
                  comparison.
                </div>
              )}
              <button
                className="primary full"
                disabled={
                  !image ||
                  !photo.lip.closed ||
                  !!lipProblem(photo.lip) ||
                  !design?.teeth.length
                }
                onClick={() =>
                  guard(async () =>
                    download(
                      await exportImage(
                        photo,
                        image!,
                        false,
                        split,
                        renderImage ?? undefined,
                      ),
                      'smile-studio-simulation.png',
                    ),
                  )
                }
              >
                <Download size={17} />
                Export simulation
              </button>
              <button
                className="full"
                disabled={
                  !image ||
                  !photo.lip.closed ||
                  !!lipProblem(photo.lip) ||
                  !design?.teeth.length
                }
                onClick={() =>
                  guard(async () =>
                    download(
                      await exportImage(
                        photo,
                        image!,
                        true,
                        split,
                        renderImage ?? undefined,
                      ),
                      'smile-studio-comparison.png',
                    ),
                  )
                }
              >
                <Download size={17} />
                Export comparison
              </button>
              <div className="note">
                Exports include a simulation label.
                <br />A visual preview is not a promised treatment result.
              </div>
              {photo.render && (
                <button
                  className="full"
                  onClick={() => edit({ ...photo, render: null })}
                >
                  Return to editable tooth layers
                </button>
              )}
            </>
          )}
          {selectedPoint &&
            photo &&
            selection &&
            selection.kind !== 'tooth' && (
              <>
                <hr />
                <div className="section-label">
                  POINT {selection.point + 1} · ORIGINAL PHOTO
                </div>
                <div className="numeric-grid">
                  <Field
                    label="Point X"
                    value={selectedPoint.x}
                    min={0}
                    max={photo.width}
                    step={0.1}
                    onChange={(n) => setPoint('x', n)}
                  />
                  <Field
                    label="Point Y"
                    value={selectedPoint.y}
                    min={0}
                    max={photo.height}
                    step={0.1}
                    onChange={(n) => setPoint('y', n)}
                  />
                </div>
                {selectedMeasurement && selection.kind === 'measurement' && (
                  <label className="field">
                    Selected point
                    <select
                      aria-label="Selected point"
                      value={selection.point}
                      onChange={(e) =>
                        setSelection({
                          ...selection,
                          point: Number(e.target.value),
                        })
                      }
                    >
                      {selectedMeasurement.points.map((_, i) => (
                        <option key={i} value={i}>
                          Point {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          {!photo && step !== 'Photos' && (
            <p className="muted">Add a photo to begin this stage.</p>
          )}
          {photo && !image && (
            <>
              <hr />
              <button
                className="full"
                onClick={() => recoverInput.current?.click()}
              >
                <Upload size={16} />
                Reattach original photo
              </button>
              <div className="note">
                Choose the same original with matching dimensions, or import its
                media backup.
              </div>
            </>
          )}
          {photo && step !== 'Compare' && (
            <>
              <hr />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={fingerEdit}
                  onChange={(e) => setFingerEdit(e.target.checked)}
                />
                Finger edit mode
              </label>
              <div className="note">
                {step === 'Teeth'
                  ? 'Finger edit mode enables single-finger tooth edits. Select a tooth or the whole smile, then pinch to scale and twist to rotate. Choose Pan to zoom the photo.'
                  : 'Pencil or mouse edits points. Two fingers pan and zoom. Finger editing is optional.'}
              </div>
            </>
          )}
          {photo && step !== 'Photos' && (
            <>
              <hr />
              <div className="section-label">
                <Sparkles size={15} />
                OPTIONAL AI ASSISTANCE
              </div>
              <p className="note">
                Suggestions are reviewed before use. Scale comes only from your
                confirmed calibration.
              </p>
              <label className="field">
                {step === 'Compare' ? 'Rendering model' : 'Assistance model'}
                <input
                  aria-label="Gemini model"
                  value={step === 'Compare' ? renderModel : assistModel}
                  onChange={(e) =>
                    step === 'Compare'
                      ? setRenderModel(e.target.value)
                      : setAssistModel(e.target.value)
                  }
                />
              </label>
              <button
                className="full"
                disabled={aiBusy || !image}
                onClick={() =>
                  guard(() =>
                    runAi(
                      step === 'Measure'
                        ? 'assessment'
                        : step === 'Lip outline'
                          ? 'outline'
                          : step === 'Teeth'
                            ? 'alignment'
                            : 'render',
                    ),
                  )
                }
              >
                <Sparkles size={16} />
                {aiBusy
                  ? 'Requesting suggestion…'
                  : step === 'Compare'
                    ? 'Request rendered preview'
                    : 'Suggest ' +
                      (step === 'Measure'
                        ? 'DSD measurements with Gemini'
                        : step === 'Lip outline'
                          ? 'lip points'
                          : 'tooth alignment')}
              </button>
              {workspace?.consent && (
                <button
                  className="text-button"
                  onClick={() =>
                    commit({ ...workspace, consent: null, updatedAt: now() })
                  }
                >
                  Revoke photo AI consent
                </button>
              )}
            </>
          )}
        </aside>
      </main>
      <footer className="app-footer">
        <span>
          SMILE STUDIO <span className="muted">/</span> A considered approach to
          smile design
        </span>
        <span>Visual simulation · Clinician review required</span>
      </footer>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,.heic,.heif"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          guard(async () => {
            for (const file of files) await addPhoto(file);
          });
        }}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) guard(() => addPhoto(f));
        }}
      />
      <input
        ref={recoverInput}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) guard(() => addPhoto(f, true));
        }}
      />
      <input
        ref={backupInput}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file)
            guard(async () => {
              const imported = await importBackup(file, user?.id);
              setCases((prev) => [...prev, ...imported]);
              if (imported[0]) setCaseId(imported[0].id);
              setNotice(
                'Backup imported as new cases. Patient AI consent must be recorded again.',
              );
            });
        }}
      />
      {review && (
        <ToothReview ready={libraryReady} onClose={() => setReview(false)} />
      )}
      {menu && (
        <Modal title="Workspace actions" close={() => setMenu(false)}>
          <button
            className="full"
            disabled={!loaded}
            onClick={() => {
              const c = {
                ...newWorkspace(),
                ...(user ? { ownerId: user.id } : {}),
              };
              setCases([...cases, c]);
              setCaseId(c.id);
              navigate('Photos');
              setMenu(false);
            }}
          >
            <Plus size={17} />
            New case
          </button>
          <button
            className="full"
            onClick={() =>
              guard(async () => {
                await exportBackup(workspace ? [workspace] : []);
                setMenu(false);
              })
            }
          >
            <Download size={17} />
            Export media backup
          </button>
          <button
            className="full"
            onClick={() => {
              backupInput.current?.click();
              setMenu(false);
            }}
          >
            <Upload size={17} />
            Import media backup
          </button>
          <button
            className="full"
            onClick={() => {
              setReview(true);
              setMenu(false);
            }}
          >
            <Layers size={17} />
            Review tooth library
          </button>
        </Modal>
      )}
      {calibration && photo && (
        <Modal title="Confirm the reference" close={() => setCalibration(null)}>
          <p>
            Enter the real length between the two reference points. Use a
            reference in the same plane as the measured feature.
          </p>
          <label className="field">
            Known reference length (mm)
            <input
              aria-label="Known reference length (mm)"
              type="number"
              min=".01"
              max="1000"
              step=".1"
              value={knownLength}
              onChange={(e) => setKnownLength(e.target.value)}
              autoFocus
            />
          </label>
          <div className="note">
            {distance(calibration[0], calibration[1]).toFixed(1)} pixels between
            the selected points
          </div>
          <button
            className="primary full"
            disabled={
              !(
                Number(knownLength) > 0 &&
                Number(knownLength) <= 1000 &&
                distance(calibration[0], calibration[1]) >= 2
              )
            }
            onClick={() => {
              edit({
                ...photo,
                calibration: {
                  points: calibration,
                  lengthMm: Number(knownLength),
                  confirmedAt: now(),
                },
              });
              setCalibration(null);
            }}
          >
            Confirm calibration
          </button>
        </Modal>
      )}
      {account && (
        <Modal
          title={user ? 'Your account' : 'Continue with your account'}
          close={() => setAccount(false)}
        >
          {user ? (
            <>
              <p>{user.email}</p>
              <button
                className="primary full"
                disabled={cloudBusy}
                onClick={() => guard(() => sync())}
              >
                <Cloud size={17} />
                {cloudBusy ? 'Syncing…' : 'Sync this case'}
              </button>
              <button
                className="full"
                disabled={cloudBusy}
                onClick={() =>
                  guard(async () => {
                    setCloudBusy(true);
                    try {
                      const rows = await fetchCloud();
                      const next = [...casesRef.current];
                      for (const row of rows) {
                        const local = next.find(
                          (c) => c.id === row.workspace.id,
                        );
                        if (!local) {
                          next.push(row.workspace);
                          versions.current.set(row.workspace.id, row.version);
                        } else if (
                          JSON.stringify(local) ===
                          JSON.stringify(row.workspace)
                        ) {
                          versions.current.set(row.workspace.id, row.version);
                        } else if (
                          !next.some(
                            (c) =>
                              c.name ===
                                row.workspace.name.slice(0, 106) +
                                  ' (cloud copy)' &&
                              JSON.stringify(c.photos) ===
                                JSON.stringify(row.workspace.photos),
                          )
                        ) {
                          next.push({
                            ...row.workspace,
                            id: uid(),
                            name:
                              row.workspace.name.slice(0, 106) +
                              ' (cloud copy)',
                            consent: null,
                            createdAt: now(),
                            updatedAt: now(),
                          });
                        }
                      }
                      casesRef.current = next;
                      setCases(next);
                      setNotice(
                        `${rows.length} cloud cases loaded. Local edits are kept; photos require a media backup on a new device.`,
                      );
                    } finally {
                      setCloudBusy(false);
                    }
                  })
                }
              >
                Load cloud cases
              </button>
              <div className="note">
                Photos and generated media stay in IndexedDB. Cloud sync stores
                structured records only.
              </div>
              <button
                className="text-button"
                onClick={() =>
                  guard(async () => {
                    await saveChain.current;
                    await saveWorkspaces(scope, casesRef.current);
                    const { error: err } = await supabase!.auth.signOut();
                    if (err) throw err;
                    setAccount(false);
                  })
                }
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p>
                Reuse your existing DSD account. You can also keep using the
                manual tools locally.
              </p>
              <label className="field">
                Email
                <input
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                className="primary full"
                disabled={authBusy || !supabase}
                onClick={() =>
                  guard(async () => {
                    setAuthBusy(true);
                    try {
                      await saveChain.current;
                      await saveWorkspaces('guest', casesRef.current);
                      const { error: err } =
                        await supabase!.auth.signInWithPassword({
                          email,
                          password,
                        });
                      if (err) throw err;
                      setPassword('');
                      setAccount(false);
                    } finally {
                      setAuthBusy(false);
                    }
                  })
                }
              >
                {authBusy ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                className="full"
                disabled={authBusy || !supabase}
                onClick={() =>
                  guard(async () => {
                    setAuthBusy(true);
                    try {
                      const { error: err } = await supabase!.auth.signUp({
                        email,
                        password,
                      });
                      if (err) throw err;
                      setNotice(
                        'Check your email to confirm your account, then sign in.',
                      );
                    } finally {
                      setAuthBusy(false);
                    }
                  })
                }
              >
                Create account
              </button>
              <div className="note">
                Local cases are separate from account cases. Export a backup
                before signing in, then import it into your account.
              </div>
            </>
          )}
        </Modal>
      )}
      {consentDialog && workspace && (
        <Modal
          title="Patient photo consent"
          close={() => setConsentDialog(false)}
        >
          <p>
            AI requests send the selected photo to Google Gemini through your
            authenticated server. Only request assistance after obtaining the
            patient’s consent for this processing.
          </p>
          <label className="checkbox consent">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            I confirm that the patient consented to photo processing by AI for
            this smile simulation.
          </label>
          <button
            className="primary full"
            disabled={!consentChecked || !user}
            onClick={() => {
              commit({
                ...workspace,
                consent: {
                  recordedAt: now(),
                  policyVersion: '1',
                  recordedBy: user!.id,
                },
                updatedAt: now(),
              });
              setConsentDialog(false);
              setConsentChecked(false);
              setNotice(
                'Consent recorded. Choose the AI request again to send the selected photo.',
              );
            }}
          >
            Record consent
          </button>
        </Modal>
      )}
      {proposal && (
        <Modal title="Review the AI proposal" close={() => setProposal(null)}>
          <p>
            {proposal.operation === 'render'
              ? 'A separate rendered preview is ready. Your editable tooth layers will be kept.'
              : 'Check the suggested coordinates before applying them. Measurements will be calculated locally from your calibration.'}
          </p>
          <div className="proposal-preview">
            {proposal.operation === 'assessment' &&
              photo &&
              (() => {
                const result = assessmentSchema.parse(proposal.result);
                return (
                  <div className="dsd-proposal-list">
                    <p>
                      Review visible endpoints. Existing measurements are kept.
                      Unavailable items include a reason.
                    </p>
                    {result.measurements.map((m) => (
                      <label className="check-row" key={m.assessmentId}>
                        <input
                          type="checkbox"
                          checked={selectedDsd.includes(m.assessmentId)}
                          disabled={!!dsdMeasurement(photo, m.assessmentId)}
                          onChange={(e) =>
                            setSelectedDsd(
                              e.target.checked
                                ? [...selectedDsd, m.assessmentId]
                                : selectedDsd.filter(
                                    (id) => id !== m.assessmentId,
                                  ),
                            )
                          }
                        />
                        <span>
                          {dsdDefinition(m.assessmentId)!.label}
                          {dsdMeasurement(photo, m.assessmentId)
                            ? ' · already measured'
                            : ` · ${m.points.length} points`}
                        </span>
                      </label>
                    ))}
                    {result.unavailable.map((m) => (
                      <p key={m.assessmentId}>
                        <strong>{dsdDefinition(m.assessmentId)!.label}</strong>{' '}
                        · {m.reason}
                      </p>
                    ))}
                  </div>
                );
              })()}
            {proposal.operation === 'landmarks' &&
              landmarkSchema
                .parse(proposal.result)
                .measurements.map((m, i) => (
                  <p key={i}>{m.label} · 2 endpoints</p>
                ))}
            {proposal.operation === 'outline' && (
              <p>
                {outlineSchema.parse(proposal.result).points.length} outline
                points · editable draft
              </p>
            )}
            {proposal.operation === 'alignment' && (
              <p>All ten upper teeth · FDI 15–25</p>
            )}
            {photo && (
              <ProposalPreview
                proposal={
                  proposal.operation === 'assessment'
                    ? {
                        ...proposal,
                        result: {
                          ...assessmentSchema.parse(proposal.result),
                          measurements: assessmentSchema
                            .parse(proposal.result)
                            .measurements.filter((m) =>
                              selectedDsd.includes(m.assessmentId),
                            ),
                        },
                      }
                    : proposal
                }
                photo={photo}
                image={image}
              />
            )}
          </div>
          <div className="note">
            Photo: {photo?.name}
            <br />
            Source revision: {proposal.source.sourceRevision} · Model:{' '}
            {proposal.model}
          </div>
          <button
            className="primary full"
            disabled={proposal.source.sourceRevision !== photo?.revision}
            onClick={() => guard(applyProposal)}
          >
            Apply reviewed proposal
          </button>
          {proposal.source.sourceRevision !== photo?.revision && (
            <p className="warning">
              This photo changed. Discard the outdated proposal and request
              another.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
function CrosshairIcon() {
  return <span className="calibration-icon">⊕</span>;
}
function PhotoThumb({ mediaKey }: { mediaKey: string }) {
  const img = useImage(mediaKey);
  return img ? <img src={img.src} alt="" /> : <ImagePlus size={22} />;
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const el = ref.current!;
    const focusable = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]',
        ),
      );
    focusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener('keydown', handler);
    return () => {
      el.removeEventListener('keydown', handler);
      old?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
