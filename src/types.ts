export type EmergencyType = 'Trauma' | 'Cardiac' | 'Stroke' | 'Respiratory' | 'Other';
export type CaseStatus = 'Dispatch' | 'EnRoute' | 'OnSite' | 'Transporting' | 'Arrived';
export type ConsciousnessLevel = 'Alert' | 'Verbal' | 'Pain' | 'Unresponsive';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Vitals {
  pulse?: number;
  bp?: string;
  spO2?: number;
  consciousness: ConsciousnessLevel;
}

export interface EmergencyCase {
  id: string;
  patientName: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  location: Location;
  incidentTime: string;
  emergencyContact?: string;
  type?: EmergencyType;
  patientCondition?: string;
  status: CaseStatus;
  vitals?: Vitals;
  injuries?: string;
  medicalHistory?: string;
  patientPhoto?: string;
  assignedHospitalId?: string;
  createdAt: string;
  updatedAt: string;
  responderId: string;
}

export interface HospitalReadiness {
  icuBeds: boolean;
  otReady: boolean;
  ventilators: boolean;
  cardiology: boolean;
  neurology: boolean;
  traumaTeam: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  location: Location;
  readiness: HospitalReadiness;
  lastUpdated: string;
}

export interface RecommendationScore {
  hospitalId: string;
  score: number;
  distance: number; // in km
  reasons: string[];
}
