import React from 'react';
import { Case, ClinicalEvaluationResult } from '../../types';
import { evaluatePeriodontalCandidate } from '../../lib/clinical-engine';
import { 
  FileText, 
  FileDown, 
  CheckCircle2, 
  AlertTriangle, 
  Scissors, 
  Layers, 
  Calendar, 
  UserCheck, 
  Sparkles 
} from 'lucide-react';

interface TreatmentPlanViewProps {
  currentCase: Case;
  onExportPdf: () => void;
  isCalibrated: boolean;
}

export const TreatmentPlanView: React.FC<TreatmentPlanViewProps> = ({
  currentCase,
  onExportPdf,
  isCalibrated
}) => {
  const activeRev = currentCase.revisions.find(r => r.id === currentCase.activeRevisionId) || currentCase.revisions[0];
  const teethList = [13, 12, 11, 21, 22, 23];

  const evaluations: Record<number, ClinicalEvaluationResult> = {};
  for (const fdi of teethList) {
    evaluations[fdi] = evaluatePeriodontalCandidate(
      currentCase.measurements[fdi],
      activeRev?.teeth[fdi],
      isCalibrated
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Top Banner & Export Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-clinical-surface rounded-2xl border border-clinical-border shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-900 to-teal-800 text-cyan-300 rounded-xl border border-cyan-700/60 shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">
                Digital Smile Design Clinical Treatment Plan
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold uppercase">
                {currentCase.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Patient: <strong className="text-slate-200">{currentCase.patientName || currentCase.patientIdentifier}</strong> | FDI Maxillary Visible Arch (13–23)
            </p>
          </div>
        </div>

        <button
          onClick={onExportPdf}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all shrink-0"
        >
          <FileDown className="w-4 h-4" />
          <span>Export Printable PDF Report</span>
        </button>
      </div>

      {/* 1. Per-Tooth FDI Measurement & Change Delta Table */}
      <div className="p-5 bg-clinical-surface rounded-2xl border border-clinical-border shadow-lg">
        <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center justify-between">
          <span>Per-Tooth Design Changes & Periodontal Clearance</span>
          <span className="text-xs text-slate-400 font-mono">FDI 13 to 23</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-clinical-border text-slate-400 font-mono text-[11px]">
                <th className="pb-2.5 font-semibold">Tooth</th>
                <th className="pb-2.5 font-semibold">Template</th>
                <th className="pb-2.5 font-semibold">Proposed &Delta;GM</th>
                <th className="pb-2.5 font-semibold">Proposed &Delta;Inc</th>
                <th className="pb-2.5 font-semibold">Bone Clearance</th>
                <th className="pb-2.5 font-semibold">KTW Remaining</th>
                <th className="pb-2.5 font-semibold">EFP Candidate Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-border/60">
              {teethList.map((fdi) => {
                const t = activeRev?.teeth[fdi];
                const ev = evaluations[fdi];

                return (
                  <tr key={fdi} className="hover:bg-clinical-darkest/40 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-cyan-400">
                      FDI #{fdi}
                    </td>
                    <td className="py-2.5 capitalize text-slate-300">
                      {t?.form || 'Rounded'} ({t?.shade || 'A1'})
                    </td>
                    <td className="py-2.5 font-mono text-emerald-400 font-semibold">
                      +{t?.gingivalShiftMm ? t.gingivalShiftMm.toFixed(1) : '0.0'} mm
                    </td>
                    <td className="py-2.5 font-mono text-sky-400 font-semibold">
                      +{t?.incisalExtensionMm ? t.incisalExtensionMm.toFixed(1) : '0.0'} mm
                    </td>
                    <td className="py-2.5 font-mono text-slate-300">
                      {ev.remainingBoneClearanceMm !== undefined ? `${ev.remainingBoneClearanceMm.toFixed(1)} mm` : '—'}
                    </td>
                    <td className="py-2.5 font-mono text-slate-300">
                      {ev.remainingKtwMm !== undefined ? `${ev.remainingKtwMm.toFixed(1)} mm` : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        ev.outcome === 'candidate_gingivectomy'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : ev.outcome === 'candidate_crown_lengthening'
                          ? 'bg-sky-950 text-sky-300 border-sky-800'
                          : ev.outcome === 'restorative_only'
                          ? 'bg-teal-950 text-teal-300 border-teal-800'
                          : ev.outcome === 'referral_periodontist'
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {ev.outcome === 'candidate_gingivectomy' && 'Gingivectomy Candidate'}
                        {ev.outcome === 'candidate_crown_lengthening' && 'Crown Lengthening Candidate'}
                        {ev.outcome === 'restorative_only' && 'Restorative Only'}
                        {ev.outcome === 'referral_periodontist' && 'Perio Specialist Referral'}
                        {ev.outcome === 'further_assessment_needed' && 'Further Assessment Needed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Proposed Clinical Sequence & Multi-Disciplinary Workflow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Sequence Steps */}
        <div className="p-5 bg-clinical-surface rounded-2xl border border-clinical-border shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>Recommended Clinical Sequence</span>
          </h3>

          <ol className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2.5 p-2 rounded-lg bg-clinical-darkest border border-clinical-border/60">
              <span className="font-mono font-bold text-cyan-400 shrink-0">01</span>
              <span>Diagnostic aesthetic presentation & photographic consent validation with patient.</span>
            </li>
            <li className="flex items-start gap-2.5 p-2 rounded-lg bg-clinical-darkest border border-clinical-border/60">
              <span className="font-mono font-bold text-cyan-400 shrink-0">02</span>
              <span>Intraoral 2D-to-3D mock-up transfer (bis-acryl trial) to evaluate phonetics and lip support.</span>
            </li>
            <li className="flex items-start gap-2.5 p-2 rounded-lg bg-clinical-darkest border border-clinical-border/60">
              <span className="font-mono font-bold text-cyan-400 shrink-0">03</span>
              <span>Periodontal surgical phase (soft tissue gingivectomy / flap crown lengthening with ostectomy as indicated).</span>
            </li>
            <li className="flex items-start gap-2.5 p-2 rounded-lg bg-clinical-darkest border border-clinical-border/60">
              <span className="font-mono font-bold text-cyan-400 shrink-0">04</span>
              <span>Tissue maturation period: Minimum 8–12 weeks healing before final restorative impression/scan.</span>
            </li>
            <li className="flex items-start gap-2.5 p-2 rounded-lg bg-clinical-darkest border border-clinical-border/60">
              <span className="font-mono font-bold text-cyan-400 shrink-0">05</span>
              <span>Conservative minimally invasive veneer preparation and final adhesive cementation.</span>
            </li>
          </ol>
        </div>

        {/* Clinical Safety & Referral Assessment */}
        <div className="p-5 bg-clinical-surface rounded-2xl border border-clinical-border shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-400" />
            <span>Biological Safeguards & Referral Criteria</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-clinical-darkest rounded-xl border border-clinical-border">
              <h4 className="font-bold text-slate-200 mb-1">Supracrestal Tissue Attachment (STA):</h4>
              <p className="text-slate-400 leading-relaxed">
                Deterministic calculation enforces a minimum of 3.0 mm between alveolar crest and the planned margin to prevent postoperative chronic inflammation and tissue rebound.
              </p>
            </div>

            <div className="p-3 bg-clinical-darkest rounded-xl border border-clinical-border">
              <h4 className="font-bold text-slate-200 mb-1">Keratinized Tissue Preservation:</h4>
              <p className="text-slate-400 leading-relaxed">
                Any excision leaving &lt; 2.0 mm of attached keratinized gingiva automatically flags a periodontist referral to consider apically repositioned flaps or soft-tissue grafting.
              </p>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl text-amber-200 text-[11px] leading-relaxed">
              <strong>Regulatory Notice:</strong> Simulations and treatment reports are diagnostic blueprints. Autonomous surgical prescriptions are excluded; all tissue clearance must be clinically sounded in person by the treating dentist.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
