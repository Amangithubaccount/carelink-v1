import React from 'react';
import { Hospital, HospitalReadiness } from '../types';
import { Bed, Activity, Thermometer, UserPlus, Brain, HeartPulse, Check, X, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  hospital: Hospital;
  onUpdate: (readiness: HospitalReadiness) => void;
}

export const HospitalStatus: React.FC<Props> = ({ hospital, onUpdate }) => {
  const toggle = (key: keyof HospitalReadiness) => {
    onUpdate({
      ...hospital.readiness,
      [key]: !hospital.readiness[key]
    });
  };

  const readinessItems = [
    { key: 'icuBeds', label: 'ICU Beds', icon: Bed },
    { key: 'otReady', label: 'OT Ready', icon: Activity },
    { key: 'ventilators', label: 'Ventilators', icon: Thermometer },
    { key: 'cardiology', label: 'Cardiologist', icon: HeartPulse },
    { key: 'neurology', label: 'Neurologist', icon: Brain },
    { key: 'traumaTeam', label: 'Trauma Team', icon: UserPlus },
  ];

  return (
    <div className="glass-panel w-full max-w-md mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{hospital.name}</h1>
          <div className="flex items-center gap-1.5 text-sub-ink text-[10px] mt-1 font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            v1 Live Bridge • Updated {formatDistanceToNow(new Date(hospital.lastUpdated))} ago
          </div>
        </div>
        <div className="bg-success/10 text-success px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-success/20">
          LIVE
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <span className="section-label">FACILITIES</span>
          <div className="grid grid-cols-2 gap-3">
            {readinessItems.slice(0, 3).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => toggle(key as keyof HospitalReadiness)}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col items-start gap-2 text-left",
                  hospital.readiness[key as keyof HospitalReadiness]
                    ? "bg-success/5 border-success/30 text-success"
                    : "bg-theme-bg border-border text-sub-ink"
                )}
              >
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", hospital.readiness[key as keyof HospitalReadiness] ? "bg-success" : "bg-border")} />
                   <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                </div>
                <div className="font-bold text-sm tracking-tight">
                  {hospital.readiness[key as keyof HospitalReadiness] ? 'AVAILABLE' : 'AT CAPACITY'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
           <span className="section-label">SPECIALISTS</span>
           <div className="grid grid-cols-2 gap-3">
            {readinessItems.slice(3).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => toggle(key as keyof HospitalReadiness)}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col items-start gap-2 text-left",
                  hospital.readiness[key as keyof HospitalReadiness]
                    ? "bg-accent/5 border-accent/30 text-accent"
                    : "bg-theme-bg border-border text-sub-ink"
                )}
              >
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", hospital.readiness[key as keyof HospitalReadiness] ? "bg-accent" : "bg-border")} />
                   <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                </div>
                <div className="font-bold text-sm tracking-tight text-ink">
                  {hospital.readiness[key as keyof HospitalReadiness] ? 'IN-HOUSE' : 'UNAVAILABLE'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-ink/5 border border-ink/10 rounded-xl text-[10px] text-sub-ink text-center font-bold uppercase tracking-widest">
        Active status broadcast initiated
      </div>
    </div>
  );
};
