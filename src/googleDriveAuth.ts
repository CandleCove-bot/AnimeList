import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

export interface DriveAuthUser {
  uid: string;
  name: string;
  email: string;
  picture: string;
}

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

function mapUser(user: User): DriveAuthUser {
  return {
    uid: user.uid,
    name: user.displayName || user.email || 'Cuenta Google',
    email: user.email || '',
    picture: user.photoURL || '',
  };
}

export const initAuth = (
  onAuthSuccess?: (user: DriveAuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(mapUser(user), cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

// Must be called from a button click or user interaction.
export const googleSignIn = async (): Promise<{
  user: DriveAuthUser;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se recibió el permiso de acceso a Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    return {
      user: mapUser(result.user),
      accessToken: cachedAccessToken,
    };
  } catch (error) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

export const logout = async (): Promise<void> => {
  cachedAccessToken = null;
  await auth.signOut();
};

export interface DriveAuthBridge {
  initAuth: typeof initAuth;
  googleSignIn: typeof googleSignIn;
  getAccessToken: typeof getAccessToken;
  clearAccessToken: typeof clearAccessToken;
  logout: typeof logout;
}

declare global {
  interface Window {
    __AnimeListDriveAuth?: DriveAuthBridge;
  }
}

window.__AnimeListDriveAuth = {
  initAuth,
  googleSignIn,
  getAccessToken,
  clearAccessToken,
  logout,
};

window.dispatchEvent(new CustomEvent('animelist-drive-auth-ready'));
