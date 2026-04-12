import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBswyYFZcS5I7YI6WAkeCDYqSaAgSFqL3w",
  authDomain: "campanestpune.firebaseapp.com",
  projectId: "campanestpune",
  storageBucket: "campanestpune.firebasestorage.app",
  messagingSenderId: "1067939689679",
  appId: "1:1067939689679:web:c23fd2250cb51b9ab4b3ba"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export default app;
