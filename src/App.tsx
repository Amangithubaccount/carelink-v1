import { useState, useEffect } from 'react';
import { EmergencyCase, Hospital, Location, RecommendationScore } from './types';
import { EmergencyForm } from './components/EmergencyForm';
import { HospitalStatus } from './components/HospitalStatus';
import { DecisionDisplay } from './components/DecisionDisplay';
import { MainMap } from './components/MainMap';
import { calculateRecommendation } from './lib/decisionEngine';
import { Shield, Ambulance, Hospital as HospitalIcon, LogOut, Activity, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { 
  dbSaveEmergencyCase, 
  dbGetEmergencyCases, 
  dbSaveAlert, 
  dbGetAlerts, 
  AlertNotification 
} from './services/appwriteService';
import { DBConnectionPanel } from './components/DBConnectionPanel';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const INITIAL_HOSPITALS: Hospital[] = [
  {
    id: 'h1',
    name: 'Metropolitan Area General Hospital',
    location: { latitude: 13.7563, longitude: 100.5018, address: 'District 1 Medical Center' },
    readiness: { icuBeds: true, otReady: true, ventilators: true, cardiology: true, neurology: false, traumaTeam: true },
    lastUpdated: new Date().toISOString()
  }
];

export default function App() {
  // Local state to track map bypass (highly useful when running locally in VS Code)
  const [bypassMaps, setBypassMaps] = useState<boolean>(() => {
    try {
      return localStorage.getItem('carelink_bypass_maps') === 'true';
    } catch (_) {
      return false;
    }
  });

  const hasValidKey = (Boolean(API_KEY) && 
                       API_KEY !== '' && 
                       API_KEY !== 'YOUR_API_KEY' && 
                       !API_KEY.includes('YOUR_GOOGLE_MAPS')) || bypassMaps;

  const [user, setUser] = useState<{ email: string; displayName: string } | null>(null);
  const [role, setRole] = useState<'responder' | 'hospital' | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>(INITIAL_HOSPITALS);
  const [currentCase, setCurrentCase] = useState<Partial<EmergencyCase> | null>(null);
  const [activeTab, setActiveTab] = useState<'intake' | 'decision' | 'transport'>('intake');
  const [recommendations, setRecommendations] = useState<RecommendationScore[]>([]);
  const [activeHoverId, setActiveHoverId] = useState<string | undefined>(undefined);

  // Appwrite & Local Storage DB states
  const [dbCases, setDbCases] = useState<EmergencyCase[]>([]);
  const [dbAlerts, setDbAlerts] = useState<AlertNotification[]>([]);

  // Load cases and alerts from DB on mount / integration sync
  const fetchDbData = async () => {
    try {
      const [casesList, alertsList] = await Promise.all([
        dbGetEmergencyCases(),
        dbGetAlerts()
      ]);
      setDbCases(casesList);
      setDbAlerts(alertsList);
    } catch (err) {
      console.error('Error fetching databases:', err);
    }
  };

  useEffect(() => {
    fetchDbData();
  }, []);

  const handleSelectHistoricCase = (selected: EmergencyCase) => {
    setCurrentCase(selected);
    if (selected.status === 'Dispatch') {
      setActiveTab('decision');
    } else if (selected.status === 'Arrived') {
      setActiveTab('transport');
    } else {
      setActiveTab('transport');
    }
  };

  // Auto-track the responder's real-time GPS coordinates
  const [responderLocation, setResponderLocation] = useState<Location>({
    latitude: 13.7563,
    longitude: 100.5018,
    address: 'Detected Coordinates'
  });

  useEffect(() => {
    if (role === 'responder' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const liveLoc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address: 'Current GPS Spot'
        };
        setResponderLocation(liveLoc);
        
        // Feed live GPS coordinates into new intake form
        if (!currentCase?.location?.latitude) {
          setCurrentCase(prev => ({
            ...prev,
            location: liveLoc
          }));
        }
      }, (err) => {
        console.warn('Geolocation tracking issue (defaults applied):', err);
      });
    }
  }, [role]);

  // Recalculate recommendations when hospitals or current case changes
  useEffect(() => {
    if (activeTab === 'decision' && currentCase?.location && hospitals.length > 0) {
      // Use fallback GPS coordinates if current position not yet locked
      const targetLoc = currentCase.location.latitude !== 0 ? currentCase.location : responderLocation;
      const recs = hospitals.map(h => 
        calculateRecommendation(h, currentCase, targetLoc as any)
      );
      setRecommendations(recs);
    }
  }, [hospitals, currentCase, activeTab, responderLocation]);

  // Sync default selection to the highest-scoring recommendation on the map
  useEffect(() => {
    if (activeTab === 'decision' && recommendations.length > 0) {
      const topRec = [...recommendations].sort((a, b) => b.score - a.score)[0];
      setActiveHoverId(topRec.hospitalId);
    }
  }, [recommendations, activeTab]);

  const handleLocationChange = (newLoc: Location) => {
    setResponderLocation(newLoc);
    setCurrentCase(prev => {
      if (!prev) {
        return {
          location: newLoc
        };
      }
      return {
        ...prev,
        location: newLoc
      };
    });
  };

  const handleUpdateHospital = async (hospitalId: string, readiness: any) => {
    const targetHName = hospitals.find(h => h.id === hospitalId)?.name || 'ED Department';
    setHospitals(prev => prev.map(h => 
      h.id === hospitalId ? { ...h, readiness, lastUpdated: new Date().toISOString() } : h
    ));

    try {
      const alert: AlertNotification = {
        id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        caseId: 'hospital-readiness',
        patientName: targetHName,
        type: 'Other',
        message: `Clinical capacity metrics updated: ICU beds & trauma teams re-briefed`,
        timestamp: new Date().toISOString(),
        status: 'OnSite'
      };
      await dbSaveAlert(alert);
      await fetchDbData();
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSelectHospital = async (hospitalId: string) => {
    if (currentCase) {
      const updatedCase: EmergencyCase = {
        ...currentCase,
        assignedHospitalId: hospitalId,
        status: 'EnRoute',
        updatedAt: new Date().toISOString()
      } as EmergencyCase;
      
      setCurrentCase(updatedCase);
      setActiveTab('transport');

      try {
        await dbSaveEmergencyCase(updatedCase);
        await fetchDbData();
      } catch (err) {
        console.warn('Appwrite select hospital error:', err);
      }
    }
  };

  const mockLogin = () => {
    setUser({ email: 'demo@carelink.med', displayName: 'Demo Professional' });
  };

  // 1. SPLASH SCREEN (MANDATORY per Google Maps platform guidelines if hasValidKey is false)
  if (!hasValidKey) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-border rounded-2xl p-8 shadow-sm space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-accent animate-pulse" />
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-ink">Google Maps API Required</h1>
            <p className="text-sub-ink text-[10px] uppercase font-black tracking-widest text-accent">CareLink Core Gateway</p>
          </div>

          <div className="space-y-4 text-xs text-sub-ink leading-relaxed">
            <p className="text-center">
              To fetch real nearby hospitals and display live interactive tracking maps, please connect your Google Maps Platform credential.
            </p>

            <div className="p-4 bg-theme-bg/50 rounded-xl border border-border space-y-3">
              <span className="section-label mb-1 block text-ink font-bold">Integration Portals</span>
              
              <div className="space-y-2">
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                  <span>
                    Get an API key: <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-accent underline font-bold">Google Maps Credentials Setup</a>.
                  </span>
                </div>
                
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                  <span>
                    Open the <strong>Settings</strong> menu (⚙️ gear icon, top-right corner of AI Studio).
                  </span>
                </div>

                <div className="flex gap-2.5">
                  <span className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                  <span>
                    Select <strong>Secrets</strong>, type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as name, and paste your key.
                  </span>
                </div>
              </div>
            </div>

            <p className="text-center text-[10px] uppercase font-black text-accent animate-pulse">
              The application will automatically recompile and boot CareLink app once added.
            </p>

            <div className="pt-3 border-t border-dashed border-border flex flex-col gap-2">
              <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider">OR FOR LOCAL VS CODE DEVELOPMENT</p>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('carelink_bypass_maps', 'true');
                  } catch (_) {}
                  setBypassMaps(true);
                }}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md shadow-zinc-900/10 active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                🚀 Continue in Offline Demo Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border border-border rounded-2xl text-center space-y-8 p-10 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-emergency rounded-xl flex items-center justify-center shadow-lg shadow-emergency/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-ink">CareLink app</h1>
            <p className="text-sub-ink text-sm font-medium">Real-Time Emergency Bridge</p>
          </div>
          
          <button 
            onClick={mockLogin}
            className="w-full high-tap-button bg-ink text-white shadow-md active:bg-ink/90"
          >
            Authenticate
          </button>
          
          <div className="text-sub-ink text-[10px] uppercase font-bold tracking-widest">
            Secure Medical Terminal
          </div>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-1 text-ink">Protocol Selection</h1>
            <p className="text-sub-ink text-sm">Please identify your active role</p>
          </div>
          
          <button 
            onClick={() => setRole('responder')}
            className="w-full h-32 bg-white rounded-xl border border-border flex items-center gap-6 px-8 transition-all hover:border-accent group text-left"
          >
            <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all text-accent">
              <Ambulance className="w-7 h-7" />
            </div>
            <div>
              <span className="block font-bold text-xl text-ink">Field Responder</span>
              <span className="text-xs text-sub-ink">Emergency Medical services</span>
            </div>
          </button>

          <button 
            onClick={() => setRole('hospital')}
            className="w-full h-32 bg-white rounded-xl border border-border flex items-center gap-6 px-8 transition-all hover:border-success group text-left"
          >
            <div className="w-14 h-14 bg-success/10 rounded-xl flex items-center justify-center group-hover:bg-success group-hover:text-white transition-all text-success">
              <HospitalIcon className="w-7 h-7" />
            </div>
            <div>
              <span className="block font-bold text-xl text-ink">ED Coordinator</span>
              <span className="text-xs text-sub-ink">Hospital Intake Control</span>
            </div>
          </button>
          
          <button onClick={() => setUser(null)} className="w-full py-4 text-sub-ink font-bold uppercase text-[11px] tracking-widest hover:text-ink transition-colors">Terminate Session</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg pb-32">
      <header className="px-6 py-4 flex justify-between items-center bg-ink text-white sticky top-0 z-50 h-16">
        <div className="flex items-center gap-3">
          <span className="bg-emergency px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase">CRITICAL</span>
          <span className="font-bold text-lg tracking-tight">CareLink app</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase opacity-60">Session User</span>
            <span className="text-xs font-medium">{user.displayName}</span>
          </div>
          <button onClick={() => setRole(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-lg mx-auto space-y-6">
        {/* DB Sync & Live Alert Board */}
        <DBConnectionPanel 
          cases={dbCases} 
          alerts={dbAlerts} 
          onSelectCase={handleSelectHistoricCase}
          onRefreshData={fetchDbData}
        />

        {/* Dynamic Live Google Map viewport for Responders */}
        {role === 'responder' && (
          <MainMap
            apiKey={API_KEY || 'AIzaSyFakeKeyDemo_BypassedKey'}
            patientLocation={currentCase?.location || responderLocation}
            hospitals={hospitals}
            selectedHospitalId={currentCase?.assignedHospitalId || activeHoverId}
            onSelectHospital={handleSelectHospital}
            onHospitalsLoaded={(realHospitals) => {
              if (realHospitals.length > 0) {
                setHospitals(realHospitals);
              }
            }}
            activeTab={activeTab}
            onLocationChange={handleLocationChange}
          />
        )}

        <AnimatePresence mode="wait">
          {role === 'responder' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="responder">
              {activeTab === 'intake' && (
                <EmergencyForm 
                  initialData={currentCase || { location: responderLocation }}
                  onSave={async (data) => {
                    const fullCase: EmergencyCase = {
                      ...data,
                      id: data.id || `CASE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                      patientName: data.patientName || 'Unknown Patient',
                      vitals: data.vitals || { consciousness: 'Alert' },
                      location: data.location || responderLocation,
                      status: 'Dispatch',
                      incidentTime: data.incidentTime || new Date().toISOString(),
                      createdAt: data.createdAt || new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      responderId: 'responder_1'
                    } as EmergencyCase;

                    setCurrentCase(fullCase);
                    setActiveTab('decision');

                    try {
                      await dbSaveEmergencyCase(fullCase);
                      await fetchDbData();
                    } catch (err) {
                      console.warn('Appwrite save case error:', err);
                    }
                  }} 
                />
              )}
              {activeTab === 'decision' && currentCase && (
                <div className="space-y-6">
                  <button onClick={() => setActiveTab('intake')} className="text-zinc-500 text-xs font-bold uppercase flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Back to intake
                  </button>
                  <DecisionDisplay 
                    hospitals={hospitals} 
                    recommendations={recommendations} 
                    currentCase={currentCase}
                    onSelect={handleSelectHospital}
                  />
                </div>
              )}
              {activeTab === 'transport' && currentCase && (
                <div className="space-y-6 text-center max-w-sm mx-auto">
                   <div className="w-20 h-20 bg-success/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Activity className="w-10 h-10 text-success " />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-ink uppercase">Transport Initiated</h2>
                  <p className="text-sub-ink text-sm mb-8">
                    Transit protocol active for <span className="text-ink font-bold">{hospitals.find(h => h.id === currentCase.assignedHospitalId)?.name}</span>.
                    Target ED has received clinical briefing.
                  </p>
                  
                  <div className="bg-white border border-border rounded-2xl p-6 text-left space-y-4 shadow-sm">
                    {currentCase.patientPhoto && (
                      <div className="w-full h-32 rounded-xl overflow-hidden mb-4 border border-border">
                        <img src={currentCase.patientPhoto} alt="Patient" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex justify-between border-b border-border pb-3">
                       <span className="section-label mb-0">Patient</span>
                       <span className="font-bold text-ink">{currentCase.patientName}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-3">
                       <span className="section-label mb-0">Priority</span>
                       <span className="text-emergency font-black uppercase text-xs">CRITICAL / CODE RED</span>
                    </div>
                    <div className="flex justify-between pt-1">
                       <span className="section-label mb-0">Destination ETA</span>
                       <span className="font-mono font-bold text-accent">LIVE TRANSIT DEPLOYED</span>
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                        const finalCase = {
                          ...currentCase,
                          status: 'Arrived' as const,
                          updatedAt: new Date().toISOString()
                        } as EmergencyCase;

                        try {
                          await dbSaveEmergencyCase(finalCase);
                          setCurrentCase(null);
                          setActiveTab('intake');
                          await fetchDbData();
                        } catch (err) {
                          console.warn('Appwrite save final status error:', err);
                          setCurrentCase(null);
                          setActiveTab('intake');
                        }
                      }} 
                    className="w-full high-tap-button severity-stable mt-8"
                  >
                    Save to Database & Close Case
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="hospital">
              {hospitals.length > 0 ? (
                <HospitalStatus 
                  hospital={hospitals[0]} 
                  onUpdate={(readiness) => handleUpdateHospital(hospitals[0].id, readiness)} 
                />
              ) : (
                <div className="glass-panel text-center p-12">
                  <Activity className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Initialising Hospital Ready Feed</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {role === 'responder' && activeTab !== 'intake' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full px-6 max-w-sm z-40">
          <div className="bg-ink border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-emergency rounded-xl flex items-center justify-center overflow-hidden">
                  {currentCase?.patientPhoto ? (
                    <img src={currentCase.patientPhoto} alt="Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <Ambulance className="w-5 h-5 text-white" />
                  )}
               </div>
               <div>
                  <div className="text-[9px] font-black uppercase text-white/40 tracking-wider">Mission Tracking</div>
                  <div className="font-bold text-sm text-white truncate max-w-[120px]">{currentCase?.patientName}</div>
               </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
               <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
               <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
