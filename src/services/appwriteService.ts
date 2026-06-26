import { Client, Databases, ID, Query } from 'appwrite';
import { EmergencyCase } from '../types';

// Read configuration from environment variables
const env = (import.meta as any).env || {};
export const ENDPOINT = env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
export const PROJECT_ID = env.VITE_APPWRITE_PROJECT_ID || '';
export const DATABASE_ID = env.VITE_APPWRITE_DATABASE_ID || 'carelink';
export const CASES_COLLECTION_ID = env.VITE_APPWRITE_CASES_COLLECTION_ID || 'cases';
export const ALERTS_COLLECTION_ID = env.VITE_APPWRITE_ALERTS_COLLECTION_ID || 'alerts';

// Interface for database alerts/notifications
export interface AlertNotification {
  id: string;
  caseId: string;
  patientName: string;
  type: string;
  message: string;
  timestamp: string;
  status: string;
}

let client: Client | null = null;
let databases: Databases | null = null;

// Initialize Appwrite Client if project ID is provided
export function isAppwriteConfigured(): boolean {
  return Boolean(PROJECT_ID && PROJECT_ID.trim() !== '');
}

if (isAppwriteConfigured()) {
  try {
    client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    databases = new Databases(client);
    console.log('Appwrite Client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Appwrite Client:', error);
  }
}

// Fallback Local Storage keys
const LS_CASES_KEY = 'carelink_cases';
const LS_ALERTS_KEY = 'carelink_alerts';

/**
 * Helper to dynamically construct a document payload containing only keys 
 * that are actually registered as attributes in the targeted Appwrite collection.
 * This guarantees no "Attribute not found" errors on document save or update.
 */
async function buildCollectionPayload(
  collectionId: string,
  possibleMappings: Record<string, any>,
  fallbackKeys: string[]
): Promise<Record<string, any>> {
  if (!databases) return {};
  
  try {
    const collection = await databases.getCollection(DATABASE_ID, collectionId);
    if (collection && Array.isArray(collection.attributes)) {
      const activeKeys = new Set(collection.attributes.map((attr: any) => attr.key));
      const filteredPayload: Record<string, any> = {};
      let matchedAny = false;
      
      for (const [key, value] of Object.entries(possibleMappings)) {
        if (activeKeys.has(key)) {
          filteredPayload[key] = value;
          matchedAny = true;
        }
      }
      if (matchedAny) {
        return filteredPayload;
      }
    }
  } catch (err) {
    console.warn(`Could not fetch metadata for collection ${collectionId}. Using static fallback list. Error:`, err);
  }
  
  // High-reliability static fallback mapping if metadata fetch failed (e.g. key permissions)
  const filteredPayload: Record<string, any> = {};
  for (const key of fallbackKeys) {
    if (key in possibleMappings) {
      filteredPayload[key] = possibleMappings[key];
    }
  }
  return filteredPayload;
}

/**
 * Saves a new or updated emergency case to the database
 */
export async function dbSaveEmergencyCase(emergencyCase: EmergencyCase): Promise<void> {
  // Always update locally first for fast UI response
  const localCases = dbGetLocalCases();
  const existingIndex = localCases.findIndex(c => c.id === emergencyCase.id);
  if (existingIndex >= 0) {
    localCases[existingIndex] = emergencyCase;
  } else {
    localCases.unshift(emergencyCase);
  }
  localStorage.setItem(LS_CASES_KEY, JSON.stringify(localCases));

  // Add an alert notification for the current case activity
  const alert: AlertNotification = {
    id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    caseId: emergencyCase.id,
    patientName: emergencyCase.patientName || 'Unknown Patient',
    type: emergencyCase.type || 'Other',
    message: `Case status updated to: ${emergencyCase.status.toUpperCase()}`,
    timestamp: new Date().toISOString(),
    status: emergencyCase.status
  };
  await dbSaveAlert(alert);

  // Sync to Appwrite if configured
  if (isAppwriteConfigured() && databases) {
    try {
      // Map complete case fields to support both traditional and snake_case models
      const possibleCasesMappings: Record<string, any> = {
        patientName: emergencyCase.patientName,
        patient_name: emergencyCase.patientName,
        status: emergencyCase.status,
        type: emergencyCase.type || 'Other',
        createdAt: emergencyCase.createdAt,
        created_at: emergencyCase.createdAt,
        patientCondition: emergencyCase.patientCondition || '',
        patient_condition: emergencyCase.patientCondition || '',
        payload: JSON.stringify(emergencyCase)
      };

      const appwriteDoc = await buildCollectionPayload(
        CASES_COLLECTION_ID,
        possibleCasesMappings,
        ['patient_name', 'status', 'type', 'created_at', 'patient_condition', 'payload']
      );

      try {
         // Force document fields to comply with standard payload wrapper if payload key is defined 
         // to ensure full client UI state restoration compatibility
         if (appwriteDoc.payload === undefined && typeof appwriteDoc === 'object') {
           const collectionMeta = await databases.getCollection(DATABASE_ID, CASES_COLLECTION_ID);
           const keys = collectionMeta.attributes.map((a: any) => a.key);
           if (keys.includes('payload')) {
             appwriteDoc.payload = JSON.stringify(emergencyCase);
           }
         }
      } catch (e) {}

      try {
        // Attempt to update first (if document with this ID already exists)
        await databases.updateDocument(
          DATABASE_ID,
          CASES_COLLECTION_ID,
          emergencyCase.id,
          appwriteDoc
        );
        console.log(`Appwrite Case Updated: ${emergencyCase.id}`);
      } catch (updateErr: any) {
        // If not found, create new document
        if (updateErr.code === 404 || updateErr.message?.includes('not found')) {
          await databases.createDocument(
            DATABASE_ID,
            CASES_COLLECTION_ID,
            emergencyCase.id, // Custom ID matching our original dispatch case
            appwriteDoc
          );
          console.log(`Appwrite Case Created: ${emergencyCase.id}`);
        } else {
          throw updateErr;
        }
      }
    } catch (err) {
      console.warn('Appwrite Case sync failed. Retaining details locally. Error:', err);
    }
  }
}

/**
 * Retrieves all stored emergency cases from Appwrite/Local Storage
 */
export async function dbGetEmergencyCases(): Promise<EmergencyCase[]> {
  // Setup standard local items as baseline
  const localCases = dbGetLocalCases();

  if (isAppwriteConfigured() && databases) {
    try {
      // Dynamically detect safe order key based on registered attributes
      let sortCaseBy = 'createdAt';
      try {
        const collection = await databases.getCollection(DATABASE_ID, CASES_COLLECTION_ID);
        const activeKeys = collection.attributes.map((attr: any) => attr.key);
        if (activeKeys.includes('created_at')) {
          sortCaseBy = 'created_at';
        }
      } catch (err) {}

      const response = await databases.listDocuments(
        DATABASE_ID,
        CASES_COLLECTION_ID,
        [Query.orderDesc(sortCaseBy), Query.limit(25)]
      );

      const parsedCases: EmergencyCase[] = response.documents.map(doc => {
        try {
          return JSON.parse(doc.payload);
        } catch {
          // If payload parsing fallback fails, rebuild structure from flat fields
          return {
            id: doc.$id,
            patientName: doc.patient_name || doc.patientName || 'Unknown Patient',
            status: doc.status || 'Dispatch',
            type: doc.type || 'Other',
            createdAt: doc.created_at || doc.createdAt || new Date().toISOString(),
            updatedAt: doc.created_at || doc.createdAt || new Date().toISOString(),
            patientCondition: doc.patient_condition || doc.patientCondition || '',
            location: { latitude: 13.7563, longitude: 100.5018, address: 'Appwrite Restored Coordinates' },
            responderId: 'appwrite_cloud'
          } as EmergencyCase;
        }
      });

      // Merge and resolve uniqueness (prefer Appwrite's up-to-date instances)
      const merged: EmergencyCase[] = [...parsedCases];
      localCases.forEach(lc => {
        if (!merged.some(mc => mc.id === lc.id)) {
          merged.push(lc);
        }
      });
      return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('Appwrite Cases fetch failed. Loading local repository. Error:', err);
      return localCases;
    }
  }

  return localCases;
}

/**
 * Saves a dynamic alert notification
 */
export async function dbSaveAlert(alert: AlertNotification): Promise<void> {
  const localAlerts = dbGetLocalAlerts();
  localAlerts.unshift(alert);
  localStorage.setItem(LS_ALERTS_KEY, JSON.stringify(localAlerts.slice(0, 50))); // Cap at 50 alerts locally

  if (isAppwriteConfigured() && databases) {
    try {
      const possibleAlertMappings = {
        caseId: alert.caseId,
        patientName: alert.patientName,
        patient_name: alert.patientName,
        type: alert.type || 'Other',
        message: alert.message,
        time: alert.timestamp,
        timestamp: alert.timestamp,
        time_stamp: alert.timestamp,
        status: alert.status
      };

      // Fallback keys match the observed schema in the user's Appwrite Console attributes list
      const appwriteDoc = await buildCollectionPayload(
        ALERTS_COLLECTION_ID,
        possibleAlertMappings,
        ['caseId', 'patient_name', 'time', 'message', 'time_stamp', 'status']
      );

      await databases.createDocument(
        DATABASE_ID,
        ALERTS_COLLECTION_ID,
        alert.id,
        appwriteDoc
      );
      console.log('Appwrite Alert synchronised:', alert.id);
    } catch (err) {
      console.warn('Appwrite Alert storage bypassed:', err);
    }
  }
}

/**
 * Retrieves all alerts / notifications
 */
export async function dbGetAlerts(): Promise<AlertNotification[]> {
  const localAlerts = dbGetLocalAlerts();

  if (isAppwriteConfigured() && databases) {
    try {
      // Dynamically detect safe order key based on registered attributes
      let sortAlertBy = 'timestamp';
      try {
        const collection = await databases.getCollection(DATABASE_ID, ALERTS_COLLECTION_ID);
        const activeKeys = collection.attributes.map((attr: any) => attr.key);
        if (activeKeys.includes('time_stamp')) {
          sortAlertBy = 'time_stamp';
        } else if (activeKeys.includes('time')) {
          sortAlertBy = 'time';
        }
      } catch (err) {}

      const response = await databases.listDocuments(
        DATABASE_ID,
        ALERTS_COLLECTION_ID,
        [Query.orderDesc(sortAlertBy), Query.limit(20)]
      );

      const parsedAlerts: AlertNotification[] = response.documents.map(doc => ({
        id: doc.$id,
        caseId: doc.caseId || '',
        patientName: doc.patient_name || doc.patientName || 'Emergency',
        type: doc.type || 'Other',
        message: doc.message || '',
        timestamp: doc.time_stamp || doc.time || doc.timestamp || new Date().toISOString(),
        status: doc.status || 'Dispatch'
      }));

      // Merge unique
      const merged: AlertNotification[] = [...parsedAlerts];
      localAlerts.forEach(la => {
        if (!merged.some(ma => ma.id === la.id)) {
          merged.push(la);
        }
      });
      return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.warn('Appwrite Alerts fetch failed. Loading local alerts.', err);
      return localAlerts;
    }
  }

  return localAlerts;
}

// Low-level Local Storage getters
function dbGetLocalCases(): EmergencyCase[] {
  try {
    const raw = localStorage.getItem(LS_CASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function dbGetLocalAlerts(): AlertNotification[] {
  try {
    const raw = localStorage.getItem(LS_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
