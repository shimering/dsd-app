import React from 'react';
import { Case, PhotoType } from '../../types';
import { Camera, RotateCw, Check, Upload, Image as ImageIcon } from 'lucide-react';
import { saveLocalPhoto } from '../../lib/storage';

interface PhotosViewProps {
  currentCase: Case;
  onUpdatePhoto: (photoType: PhotoType, url: string, orientationDeg: number) => void;
  onSelectActivePhoto: (photoType: PhotoType) => void;
}

export const PhotosView: React.FC<PhotosViewProps> = ({
  currentCase,
  onUpdatePhoto,
  onSelectActivePhoto
}) => {
  const photoSlots: { type: PhotoType; title: string; description: string }[] = [
    {
      type: 'smile',
      title: 'Full Smile (Close-Up)',
      description: 'Primary design photograph. Captures relaxed and maximum smile dynamics.'
    },
    {
      type: 'frontal_face',
      title: 'Frontal Full Face',
      description: 'Assesses facial midline, bipupillary horizontal plane, and facial thirds.'
    },
    {
      type: 'retracted',
      title: 'Retracted Intraoral',
      description: 'Displays gingival margins, CEJ location, and existing axial inclinations.'
    }
  ];

  const handleFileUpload = async (type: PhotoType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await saveLocalPhoto(currentCase.id, type, dataUrl);
      onUpdatePhoto(type, dataUrl, 0);
    };
    reader.readAsDataURL(file);
  };

  const handleRotate = (type: PhotoType) => {
    const photo = currentCase.photos[type];
    if (!photo) return;
    const nextDeg = ((photo.orientationDeg || 0) + 90) % 360;
    onUpdatePhoto(type, photo.url, nextDeg);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      
      <div className="p-5 bg-clinical-surface rounded-2xl border border-clinical-border">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Camera className="w-5 h-5 text-cyan-400" />
          <span>Patient Photographic Records</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Photographs are stored securely in local device storage. Original aspect ratio and uncompressed resolution are preserved.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {photoSlots.map((slot) => {
          const photo = currentCase.photos[slot.type];
          const isActive = currentCase.activePhotoType === slot.type;

          return (
            <div
              key={slot.type}
              className={`p-4 bg-clinical-surface rounded-xl border flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-cyan-500 ring-1 ring-cyan-500/40 shadow-xl'
                  : 'border-clinical-border hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs text-slate-100">{slot.title}</h3>
                  {isActive && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      ACTIVE CANVAS
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mb-3 min-h-[32px]">
                  {slot.description}
                </p>

                {/* Photo Preview or Empty Slot */}
                <div className="relative aspect-[4/3] bg-clinical-darkest rounded-lg border border-clinical-border overflow-hidden flex items-center justify-center group mb-3">
                  {photo?.url ? (
                    <img
                      src={photo.url}
                      alt={slot.title}
                      className="w-full h-full object-contain"
                      style={{ transform: `rotate(${photo.orientationDeg || 0}deg)` }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span className="text-xs font-mono">No Photo Uploaded</span>
                    </div>
                  )}

                  {/* Rotate Button on hover */}
                  {photo?.url && (
                    <button
                      onClick={() => handleRotate(slot.type)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rotate 90 degrees"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-clinical-border">
                <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-clinical-darkest hover:bg-clinical-border border border-clinical-border text-xs text-slate-200 cursor-pointer font-medium transition-all">
                  <Upload className="w-3 h-3 text-cyan-400" />
                  <span>{photo?.url ? 'Replace' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => handleFileUpload(slot.type, e)}
                    className="hidden"
                  />
                </label>

                {photo?.url && !isActive && (
                  <button
                    onClick={() => onSelectActivePhoto(slot.type)}
                    className="py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-all shadow-sm"
                  >
                    Select as Canvas
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
