import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

// Safe check for localStorage
let currentConfig: any = { ...defaultFirebaseConfig };
let firestoreDbId = defaultFirebaseConfig.firestoreDatabaseId;

try {
  const customConfigStr = typeof window !== 'undefined' ? window.localStorage.getItem('NEXUS_CUSTOM_FIREBASE_CONFIG') : null;
  if (customConfigStr) {
    const customConfig = JSON.parse(customConfigStr);
    if (customConfig && customConfig.apiKey && customConfig.projectId) {
      currentConfig = { ...currentConfig, ...customConfig };
      if (customConfig.firestoreDatabaseId) {
        firestoreDbId = customConfig.firestoreDatabaseId;
      }
    }
  }
} catch (error) {
  console.warn("Erro ao carregar configuração customizada do Firebase:", error);
}

const app = getApps().length === 0 ? initializeApp(currentConfig) : getApp();
export const db = getFirestore(app, firestoreDbId); // CRITICAL: The app will break without this line
export const auth = getAuth(app);

export const isUsingCustomFirebase = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage.getItem('NEXUS_CUSTOM_FIREBASE_CONFIG');
  } catch {
    return false;
  }
};

export const saveCustomFirebaseConfig = (config: any) => {
  if (typeof window !== 'undefined') {
    if (config) {
      window.localStorage.setItem('NEXUS_CUSTOM_FIREBASE_CONFIG', JSON.stringify(config));
    } else {
      window.localStorage.removeItem('NEXUS_CUSTOM_FIREBASE_CONFIG');
    }
  }
};
