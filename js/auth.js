import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEuv16b9QBRjw9SlHgzMFINsFILvhQqSw",
  authDomain: "id-card-generator-65d63.firebaseapp.com",
  projectId: "id-card-generator-65d63",
  storageBucket: "id-card-generator-65d63.appspot.com",
  messagingSenderId: "257168652477",
  appId: "1:257168652477:web:9bc679aabc3178e49e9fd4",
};

const USER_PROFILE_SESSION_KEY = "portal-user-profile";
const USER_SESSION_KEY = "user";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export function normalizeRole(role) {
  if (role === "field") {
    return "staff";
  }

  return role || "";
}

function readCachedUserProfile(uid) {
  try {
    const rawValue = sessionStorage.getItem(USER_PROFILE_SESSION_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue?.uid === uid ? parsedValue : null;
  } catch (error) {
    console.warn("Unable to read cached user profile:", error);
    return null;
  }
}

function cacheUserProfile(profile) {
  try {
    sessionStorage.setItem(USER_PROFILE_SESSION_KEY, JSON.stringify(profile));
    sessionStorage.setItem(
      USER_SESSION_KEY,
      JSON.stringify({
        uid: profile.uid,
        name: profile.name || "User",
        role: profile.role || "",
      }),
    );
  } catch (error) {
    console.warn("Unable to cache user profile:", error);
  }
}

function clearCachedUserProfile() {
  try {
    sessionStorage.removeItem(USER_PROFILE_SESSION_KEY);
    sessionStorage.removeItem(USER_SESSION_KEY);
  } catch (error) {
    console.warn("Unable to clear cached user profile:", error);
  }
}

export function getSessionUser() {
  try {
    const rawValue = sessionStorage.getItem(USER_SESSION_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue?.uid) {
      return null;
    }

    return {
      uid: parsedValue.uid,
      name: parsedValue.name || "User",
      role: parsedValue.role || "",
    };
  } catch (error) {
    console.warn("Unable to read session user:", error);
    return null;
  }
}

export {
  app,
  auth,
  db,
  storage,
  functions,
  firebaseConfig,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  ref,
  uploadString,
  getDownloadURL,
  httpsCallable,
};

export function isFirebaseConfigured() {
  return true;
}

export function isAdminUser(subject) {
  if (!subject) {
    return false;
  }

  if (subject.role) {
    return normalizeRole(subject.role) === "admin";
  }

  if (subject.profile?.role) {
    return normalizeRole(subject.profile.role) === "admin";
  }

  return false;
}

export function isStaffUser(subject) {
  if (!subject) {
    return false;
  }

  if (subject.role) {
    return normalizeRole(subject.role) === "staff";
  }

  if (subject.profile?.role) {
    return normalizeRole(subject.profile.role) === "staff";
  }

  return false;
}

export function getRouteForRole(role) {
  return normalizeRole(role) === "admin" ? "./index.html#admin" : "./index.html";
}

export async function loginWithEmailPassword(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutCurrentUser() {
  clearCachedUserProfile();
  return signOut(auth);
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function waitForAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getUserProfileByUid(uid, { forceRefresh = false } = {}) {
  if (!uid) {
    return null;
  }

  if (!forceRefresh) {
    const cachedProfile = readCachedUserProfile(uid);

    if (cachedProfile) {
      return cachedProfile;
    }
  }

  const userDocSnapshot = await getDoc(doc(db, "users", uid));

  if (!userDocSnapshot.exists()) {
    throw new Error("User role is not configured in Firestore.");
  }

  const userData = userDocSnapshot.data();
  const profile = {
    uid,
    role: normalizeRole(userData.role || ""),
    name: userData.name || "User",
  };

  cacheUserProfile(profile);
  return profile;
}

export async function getCurrentUserProfile() {
  const user = await waitForAuthState();

  if (!user) {
    return null;
  }

  const profile = await getUserProfileByUid(user.uid);
  return { user, profile };
}

export async function requireAuthenticatedUser({ redirectTo = "./login.html" } = {}) {
  const user = await waitForAuthState();

  if (!user) {
    window.location.href = redirectTo;
    return null;
  }

  return user;
}

export async function requireRole(role, { redirectTo = "./login.html" } = {}) {
  const user = await requireAuthenticatedUser({ redirectTo });

  if (!user) {
    return null;
  }

  const profile = await getUserProfileByUid(user.uid);

  if (normalizeRole(profile.role) !== normalizeRole(role)) {
    window.location.href = getRouteForRole(profile.role);
    return null;
  }

  return { user, profile };
}

export async function requireAdminAccess({ redirectTo = "./login.html" } = {}) {
  return requireRole("admin", { redirectTo });
}
