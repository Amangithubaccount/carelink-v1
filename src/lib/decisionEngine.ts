import { Hospital, EmergencyCase, RecommendationScore } from '../types';

/**
 * Calculates a recommendation score for a hospital based on distance and readiness.
 * Weightage:
 * - Distance: 40% (Max 50km normalized)
 * - Critical Facilities (ICU, OT, Ventilator): 30%
 * - Specialists (Cardio, Neuro, Trauma): 20%
 * - Recency: 10% (Bonus for updates < 30 mins)
 */
export function calculateRecommendation(
  hospital: Hospital,
  currentCase: Partial<EmergencyCase>,
  responderLocation: { latitude: number; longitude: number }
): RecommendationScore {
  const distance = getDistance(
    responderLocation.latitude,
    responderLocation.longitude,
    hospital.location.latitude,
    hospital.location.longitude
  );

  let score = 0;
  const reasons: string[] = [];

  // 1. Distance Score (0-40 points)
  // Optimal < 5km, Degrades until 50km
  const distScore = Math.max(0, 40 * (1 - Math.min(distance, 50) / 50));
  score += distScore;
  if (distance < 5) reasons.push('Ultra-fast transit time');
  else if (distance < 15) reasons.push('Acceptable distance');

  // 2. Critical Facilities Score (0-30 points)
  const { readiness } = hospital;
  let facilityScore = 0;
  if (readiness.icuBeds) facilityScore += 10;
  if (readiness.otReady) facilityScore += 10;
  if (readiness.ventilators) facilityScore += 10;
  
  // Case-specific requirement matching
  if (currentCase.type === 'Trauma' && !readiness.otReady) facilityScore -= 15; // Critical penalty
  if (currentCase.type === 'Respiratory' && !readiness.ventilators) facilityScore -= 15;

  score += Math.max(0, facilityScore);
  if (readiness.icuBeds && readiness.otReady) reasons.push('Full critical facility readiness');

  // 3. Specialists Score (0-20 points)
  let specialistScore = 0;
  if (readiness.cardiology) specialistScore += 7;
  if (readiness.neurology) specialistScore += 7;
  if (readiness.traumaTeam) specialistScore += 6;

  // Case-specific specialty matching
  if (currentCase.type === 'Cardiac' && readiness.cardiology) specialistScore += 10; // Bonus
  if (currentCase.type === 'Stroke' && readiness.neurology) specialistScore += 10;
  if (currentCase.type === 'Trauma' && readiness.traumaTeam) specialistScore += 10;

  score += specialistScore;
  if (currentCase.type === 'Cardiac' && readiness.cardiology) reasons.push('Cardiologist available');

  // 4. Recency Score (0-10 points)
  const lastUpdate = new Date(hospital.lastUpdated).getTime();
  const now = Date.now();
  const diffMins = (now - lastUpdate) / (1000 * 60);
  
  if (diffMins < 15) {
    score += 10;
    reasons.push('Live-verified status');
  } else if (diffMins < 60) {
    score += 5;
  }

  return {
    hospitalId: hospital.id,
    score: Math.round(score),
    distance: Math.round(distance * 10) / 10,
    reasons: reasons.slice(0, 3)
  };
}

// Haversine formula for distance
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
