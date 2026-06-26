import React, { useState } from 'react';
import { Database, Bell, RefreshCw, Server, CheckCircle2, History, X, ChevronDown, ChevronUp, AlertCircle, Sparkles } from 'lucide-react';
import { EmergencyCase } from '../types';
import { isAppwriteConfigured, AlertNotification, PROJECT_ID, DATABASE_ID, CASES_COLLECTION_ID, ALERTS_COLLECTION_ID } from '../services/appwriteService';

interface DBConnectionPanelProps {
  cases: EmergencyCase[];
  alerts: AlertNotification[];
  onSelectCase?: (emergencyCase: EmergencyCase) => void;
  onRefreshData?: () => Promise<void>;
}

export const DBConnectionPanel: React.FC<DBConnectionPanelProps> = ({
  cases,
  alerts,
  onSelectCase,
  onRefreshData
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'history' | 'config'>('alerts');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const configured = isAppwriteConfigured();

  const handleRefresh = async () => {
    if (!onRefreshData) return;
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="w-full bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between bg-zinc-50 hover:bg-zinc-100/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <Database className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-ink">Database & Alerts Vault</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {configured ? 'Appwrite Connected' : 'Local Storage Sandbox'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {configured ? 'Synchronising dispatch telemetry & real-time briefings' : 'Draft mode active - local offline caching'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefreshData && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              title="Sync Database"
              className={`p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>

      {/* Expandable Panel */}
      {isOpen && (
        <div className="border-t border-border flex flex-col h-[320px]">
          {/* Sub Navigation */}
          <div className="flex border-b border-border bg-zinc-50/50">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'alerts' ? 'border-accent text-accent bg-white' : 'border-transparent text-zinc-500 hover:text-ink'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Alert Log ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history' ? 'border-accent text-accent bg-white' : 'border-transparent text-zinc-500 hover:text-ink'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Historic Vault ({cases.length})
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'config' ? 'border-accent text-accent bg-white' : 'border-transparent text-zinc-500 hover:text-ink'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Appwrite Settings
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-white">
            {activeTab === 'alerts' && (
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                    🔔 No dispatch alerts received yet
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl flex items-start gap-2.5 transition-all hover:bg-zinc-100/50"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        alert.status === 'Dispatch' ? 'bg-red-500 animate-ping' :
                        alert.status === 'EnRoute' ? 'bg-amber-500' :
                        alert.status === 'OnSite' ? 'bg-blue-500' :
                        alert.status === 'Transporting' ? 'bg-teal-500' : 'bg-emerald-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-xs text-zinc-900 uppercase truncate">
                            {alert.patientName}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-zinc-400 shrink-0">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[8px] bg-zinc-200/60 text-zinc-600 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">
                            {alert.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2">
                {cases.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                    📂 No emergency cases recorded in database
                  </div>
                ) : (
                  cases.map((cs) => (
                    <div
                      key={cs.id}
                      onClick={() => onSelectCase && onSelectCase(cs)}
                      className={`p-3 border rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                        onSelectCase ? 'hover:border-accent hover:bg-accent/5' : ''
                      } border-border bg-white`}
                    >
                      <div className="min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-ink truncate uppercase">
                            {cs.patientName}
                          </span>
                          <span className="text-[8px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-mono font-black uppercase shrink-0">
                            {cs.type || 'Other'}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase max-w-[210px] truncate">
                          💡 {cs.patientCondition || 'No condition described'}
                        </p>
                        <span className="text-[8px] font-mono text-zinc-400 font-medium block mt-0.5">
                          Saved: {new Date(cs.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          cs.status === 'Arrived' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-700 font-mono animate-pulse'
                        }`}>
                          {cs.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-4 text-xs font-semibold text-zinc-600 leading-relaxed">
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-ink font-black uppercase text-[10px] tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    Appwrite Sync Status
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    This CareLink deployment connects seamlessly to any instance of the Appwrite open-source cloud backend.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="section-label font-bold text-ink mb-1 block">Connection Checklist</span>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Appwrite dependency loaded and configured</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className={`p-0.5 mt-0.5 rounded ${configured ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {configured ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      </div>
                      <div>
                        <span className="font-bold text-zinc-800 text-[11px]">PROJECT ID BINDING</span>
                        <p className="text-[10px] text-zinc-500">
                          {configured ? `Connected securely to ID: ${PROJECT_ID.slice(0, 10)}...` : 'Missing project binding. Go to applet environment variables to add project ID.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className={`p-0.5 mt-0.5 rounded ${configured ? 'text-emerald-500' : 'text-zinc-400'}`}>
                        {configured ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0 text-zinc-400" />}
                      </div>
                      <div>
                        <span className="font-bold text-zinc-800 text-[11px]">DATABASES & CHANNELS</span>
                        <p className="text-[10px] text-zinc-500">
                          {configured ? (
                            <>
                              Verified active synchronization channels: <code>{DATABASE_ID}</code> → <code>{CASES_COLLECTION_ID}</code> & <code>{ALERTS_COLLECTION_ID}</code>.
                            </>
                          ) : (
                            <>
                              Integrates standard collection identifiers: <code>{DATABASE_ID}</code> → <code>{CASES_COLLECTION_ID}</code> & <code>{ALERTS_COLLECTION_ID}</code>.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-theme-bg/60 rounded-xl border border-border space-y-2">
                  <span className="section-label mb-1 block text-ink font-bold">Configure Appwrite in Environment</span>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    1. Navigate to <strong>Settings</strong> menu (⚙️ gear icon, top-right).
                    <br />
                    2. Select <strong>Secrets</strong>.
                    <br />
                    3. Define the secrets name: <strong>VITE_APPWRITE_PROJECT_ID</strong> and input your Appwrite project token.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
