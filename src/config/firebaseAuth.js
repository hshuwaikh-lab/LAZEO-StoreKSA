import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';

export async function registerUser(email, password) {
  if (!auth) {
    return { success: false, error: 'Firebase is not configured' };
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✔️ User created:', userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('❌ Error:', error.code, error.message);
    return { success: false, error: error.code || error.message || 'firebase-register-failed' };
  }
}

export async function loginUser(email, password) {
  if (!auth) {
    return { success: false, error: 'Firebase is not configured' };
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✔️ Logged in:', userCredential.user);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('❌ Error:', error.code, error.message);
    return { success: false, error: error.code || error.message || 'firebase-login-failed' };
  }
}

export async function signInWithGoogle() {
  if (!auth) {
    return { success: false, error: 'Firebase is not configured' };
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user, providerId: result.providerId };
  } catch (error) {
    console.error('❌ Google sign-in error:', error.code, error.message);
    return { success: false, error: error.code || error.message || 'firebase-google-signin-failed' };
  }
}

export async function signInWithApple() {
  if (!auth) {
    return { success: false, error: 'Firebase is not configured' };
  }
  try {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user, providerId: result.providerId };
  } catch (error) {
    console.error('❌ Apple sign-in error:', error.code, error.message);
    return { success: false, error: error.code || error.message || 'firebase-apple-signin-failed' };
  }
}
