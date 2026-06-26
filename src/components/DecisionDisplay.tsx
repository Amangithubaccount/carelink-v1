import React from 'react';
import { Hospital, RecommendationScore, EmergencyCase } from '../types';
import { MapPin, Navigation, Star, Heart, Activity, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  recommendations: RecommendationScore[];
  hospitals: Hospital[];
  currentCase: Partial<EmergencyCase>;
  onSelect: (hospitalId: string) => void;
}

export const DecisionDisplay: React.FC<Props> = ({ recommendations, hospitals, currentCase, onSelect }) => {
  const sorted = [...recommendations].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-ink">Decision Engine</h2>
        <p className="text-sub-ink text-xs uppercase font-bold tracking-wider">Recommended survival match</p>
      </div>

      <div className="space-y-4">
        {sorted.map((rec, index) => {
          const hospital = hospitals.find(h => h.id === rec.hospitalId);
          if (!hospital) return null;

          const isBest = index === 0;

          return (
            <motion.div
              key={rec.hospitalId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(rec.hospitalId)}
              className={cn(
                "relative p-5 bg-white border border-border rounded-2xl cursor-pointer transition-all active:scale-98 shadow-sm",
                isBest ? "border-accent ring-1 ring-accent bg-accent/5" : "hover:border-sub-ink/30"
              )}
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg",
                    isBest ? "bg-accent text-white shadow-lg shadow-accent/20" : "bg-theme-bg text-sub-ink"
                  )}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-ink leading-tight">{hospital.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-sub-ink mt-0.5 font-bold uppercase tracking-wider">
                      <Navigation className="w-3 h-3" />
                      {rec.distance} KM • {Math.round(rec.distance * 2)} MIN TRAVEL
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "font-black text-sm",
                    isBest ? "text-accent" : "text-sub-ink"
                  )}>
                    {rec.score}% MATCH
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {rec.reasons.map((reason, ri) => (
                  <span key={ri} className="tag">
                    {reason}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      <button className="w-full high-tap-button severity-critical text-sm tracking-[0.2em] shadow-xl">
        Select Hospital
      </button>
    </div>
  );
};
