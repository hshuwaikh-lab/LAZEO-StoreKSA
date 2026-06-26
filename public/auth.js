import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnFRivCXPgIHJfgqjHuCENZCCOQK49hFY",
  authDomain: "laszeo-store-ksa.firebaseapp.com",
  projectId: "laszeo-store-ksa",
  storageBucket: "laszeo-store-ksa.firebasestorage.app",
  messagingSenderId: "111955440984",
  appId: "1:111955440984:web:aa196a06c398e3688c212d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export async function registerUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("✔️ User created:", userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("❌ Error:", error.code, error.message);
    return { success: false, error: error.code };
  }
}

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✔️ Logged in:", userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("❌ Error:", error.code, error.message);
    return { success: false, error: error.code };
  }
}
