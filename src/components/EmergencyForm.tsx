import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Clock, User, Phone, Activity, Heart, Brain, AlertTriangle, X } from 'lucide-react';
import { EmergencyCase, EmergencyType, CaseStatus, ConsciousnessLevel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  onSave: (data: Partial<EmergencyCase>) => void;
  initialData?: Partial<EmergencyCase>;
}

export const EmergencyForm: React.FC<Props> = ({ onSave, initialData }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<EmergencyCase>>(initialData || {
    status: 'Dispatch',
    incidentTime: new Date().toISOString(),
    location: { latitude: 0, longitude: 0 },
    vitals: { consciousness: 'Alert' }
  });

  const updateVitals = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      vitals: { ...prev.vitals as any, [key]: value }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, patientPhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (navigator.geolocation && !initialData?.location?.latitude) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, address: 'Auto-GPS Location' }
        }));
      });
    }
  }, []);

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
            <Clock className="text-accent w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">30-Second Intake</h2>
            <p className="text-sub-ink text-xs uppercase font-bold tracking-wider">Critical baseline</p>
          </div>
        </div>
        {!formData.location?.latitude && (
          <div className="flex items-center gap-2 text-[10px] font-black text-accent animate-pulse">
            <Activity className="w-3 h-3" />
            FINDING GPS...
          </div>
        )}
      </div>

      {/* Patient Photo Section */}
      <div className="relative group">
        <div className={cn(
          "h-48 w-full rounded-2xl border-2 border-dashed border-border overflow-hidden flex flex-col items-center justify-center transition-all",
          formData.patientPhoto ? "border-solid border-success/30" : "hover:border-accent/40 bg-theme-bg/50"
        )}>
          {formData.patientPhoto ? (
            <div className="relative w-full h-full">
              <img src={formData.patientPhoto} alt="Patient" className="w-full h-full object-cover" />
              <button 
                onClick={() => setFormData(prev => ({ ...prev, patientPhoto: undefined }))}
                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-2 p-4">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              <div className="w-12 h-12 bg-white border border-border rounded-2xl flex items-center justify-center shadow-sm">
                <Camera className="w-6 h-6 text-sub-ink" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-sub-ink">Capture Patient Photo</span>
              <span className="text-[9px] text-sub-ink/60 text-center uppercase font-bold">Standard field protocol v1</span>
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1">
          <span className="section-label">Patient Name</span>
          <input
            type="text"
            placeholder="MARCO RODRIGUEZ"
            className="w-full bg-theme-bg border border-border rounded-xl px-4 py-4 text-lg font-bold text-ink focus:ring-2 focus:ring-accent outline-none placeholder:opacity-30 uppercase"
            value={formData.patientName || ''}
            onChange={e => setFormData({ ...formData, patientName: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="section-label">Age</span>
            <input
              type="number"
              placeholder="45"
              className="w-full bg-theme-bg border border-border rounded-xl px-4 py-4 text-lg font-bold text-ink outline-none"
              value={formData.age || ''}
              onChange={e => setFormData({ ...formData, age: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <span className="section-label">Gender</span>
            <select
              className="w-full bg-theme-bg border border-border rounded-xl px-4 py-4 text-lg font-bold text-ink outline-none appearance-none uppercase"
              value={formData.gender || ''}
              onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
            >
              <option value="">SELECT</option>
              <option value="male">MALE</option>
              <option value="female">FEMALE</option>
              <option value="other">OTHER</option>
              <option value="unknown">UNKNOWN</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-theme-bg rounded-xl border border-border">
          <MapPin className="text-emergency w-5 h-5 shrink-0" />
          <span className="text-xs font-mono font-bold text-sub-ink">
            {formData.location?.latitude ? `GPS: ${formData.location.latitude.toFixed(4)}° N, ${formData.location.longitude.toFixed(4)}° E` : 'Detecting GPS...'}
          </span>
        </div>
      </div>
      
      <button
        onClick={() => setStep(2)}
        disabled={!formData.patientName}
        className="w-full high-tap-button severity-critical mt-4 shadow-xl"
      >
        Continue to Assessment
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emergency/10 rounded-xl flex items-center justify-center">
          <Activity className="text-emergency w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink">Clinical Assessment</h2>
          <p className="text-sub-ink text-xs uppercase font-bold tracking-wider">Vitals & Classification</p>
        </div>
      </div>

      <div className="space-y-3">
        <span className="section-label">Patient Condition</span>
        <textarea
          placeholder="ENTER PATIENT'S CURRENT CONDITION AND REASON FOR DISPATCH..."
          className="w-full h-24 bg-theme-bg border border-border rounded-xl px-4 py-3 text-xs font-bold text-ink outline-none placeholder:opacity-30 uppercase resize-none focus:ring-1 focus:ring-accent"
          value={formData.patientCondition || ''}
          onChange={e => {
            const val = e.target.value;
            // Map keywords to help decision calculations under-the-hood
            let detectedType: EmergencyType = 'Other';
            const lower = val.toLowerCase();
            if (lower.includes('cardiac') || lower.includes('heart') || lower.includes('infarct') || lower.includes('chest pain') || lower.includes('cardio') || lower.includes('bpm')) {
              detectedType = 'Cardiac';
            } else if (lower.includes('stroke') || lower.includes('brain') || lower.includes('neuro') || lower.includes('speech') || lower.includes('paraly') || lower.includes('facial')) {
              detectedType = 'Stroke';
            } else if (lower.includes('respiratory') || lower.includes('breath') || lower.includes('dyspnea') || lower.includes('lung') || lower.includes('chok') || lower.includes('asthma')) {
              detectedType = 'Respiratory';
            } else if (lower.includes('trauma') || lower.includes('accident') || lower.includes('wound') || lower.includes('bleed') || lower.includes('fall') || lower.includes('injury') || lower.includes('fracture')) {
              detectedType = 'Trauma';
            }

            setFormData(prev => ({
              ...prev,
              patientCondition: val,
              type: detectedType
            }));
          }}
        />
      </div>

      <div className="space-y-3">
        <span className="section-label">Consciousness (AVPU)</span>
        <div className="grid grid-cols-4 gap-2">
          {(['Alert', 'Verbal', 'Pain', 'Unresponsive'] as ConsciousnessLevel[]).map(level => (
            <button
              key={level}
              onClick={() => updateVitals('consciousness', level)}
              className={cn(
                "py-3 rounded-lg border text-[10px] font-black uppercase transition-all",
                formData.vitals?.consciousness === level ? "bg-ink text-white border-ink shadow-md" : "bg-white border-border text-sub-ink"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <span className="section-label text-center block mb-0">Pulse</span>
          <div className="bg-white border border-border rounded-xl p-3 text-center">
             <input
              type="number"
              placeholder="BPM"
              className="w-full text-center font-bold text-xl outline-none placeholder:text-zinc-200"
              onChange={e => updateVitals('pulse', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <span className="section-label text-center block mb-0">BP</span>
          <div className="bg-white border border-border rounded-xl p-3 text-center">
            <input
              type="text"
              placeholder="SYS/DIA"
              className="w-full text-center font-bold text-lg outline-none placeholder:text-zinc-200"
              onChange={e => updateVitals('bp', e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <span className="section-label text-center block mb-0">SpO2</span>
           <div className="bg-white border border-border rounded-xl p-3 text-center">
            <input
              type="number"
              placeholder="%"
              className="w-full text-center font-bold text-xl outline-none placeholder:text-zinc-200"
              onChange={e => updateVitals('spO2', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => setStep(1)} className="flex-1 high-tap-button bg-white border border-border text-sub-ink">Back</button>
        <button onClick={() => onSave(formData)} className="flex-[2] high-tap-button severity-critical">Find Hospital</button>
      </div>
    </div>
  );

  return (
    <div className="glass-panel w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 ? renderStep1() : renderStep2()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
