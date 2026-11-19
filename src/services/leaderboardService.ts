import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeLeaderboardPayload } from '../game/musicData';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface LeaderboardEntry {
  uid: string;
  playerName: string;
  score: number;
  bestCombo: number;
  accuracy: number;
  songsCompleted: number;
  mode: 'desafio';
  isPublic: boolean;
  updatedAt?: Timestamp | null;
}

export function subscribeAuthUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeGlobalLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'scores';
  const q = query(
    collection(db, path),
    where('isPublic', '==', true),
    where('score', '>=', 0),
    orderBy('score', 'desc'),
    limit(20),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: LeaderboardEntry[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        rows.push({
          uid: String(d.uid ?? docSnap.id),
          playerName: String(d.playerName ?? 'Viajante'),
          score: Number(d.score ?? 0),
          bestCombo: Number(d.bestCombo ?? 0),
          accuracy: Number(d.accuracy ?? 0),
          songsCompleted: Number(d.songsCompleted ?? 0),
          mode: 'desafio',
          isPublic: Boolean(d.isPublic ?? true),
          updatedAt: (d.updatedAt as Timestamp | undefined) ?? null,
        });
      });
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function submitCloudScore(input: {
  playerName: string;
  score: number;
  bestCombo: number;
  accuracy: number;
  songsCompleted: number;
}): Promise<{ saved: boolean; isNewRecord: boolean }> {
  const user = auth.currentUser;
  if (!user) {
    return { saved: false, isNewRecord: false };
  }

  const sanitized = sanitizeLeaderboardPayload({
    uid: user.uid,
    playerName: input.playerName || user.displayName || 'Viajante',
    score: input.score,
    bestCombo: input.bestCombo,
    accuracy: input.accuracy,
    songsCompleted: input.songsCompleted,
  });

  if (!sanitized) {
    throw new Error('Dados de pontuação inválidos.');
  }

  const docPath = `scores/${user.uid}`;
  const docRef = doc(db, 'scores', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(docRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { saved: true, isNewRecord: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }

  const prev = existingSnap.data();
  const prevScore = Number(prev?.score ?? 0);

  if (sanitized.score < prevScore) {
    // Only update nickname if changed, without lowering existing high score
    if (sanitized.playerName !== prev?.playerName) {
      try {
        await updateDoc(docRef, {
          playerName: sanitized.playerName,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    }
    return { saved: true, isNewRecord: false };
  }

  try {
    await updateDoc(docRef, {
      playerName: sanitized.playerName,
      score: sanitized.score,
      bestCombo: Math.max(Number(prev?.bestCombo ?? 0), sanitized.bestCombo),
      accuracy: sanitized.accuracy,
      songsCompleted: Math.max(Number(prev?.songsCompleted ?? 0), sanitized.songsCompleted),
      updatedAt: serverTimestamp(),
    });
    return { saved: true, isNewRecord: sanitized.score > prevScore };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updatePlayerNickname(newName: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const sanitized = sanitizeLeaderboardPayload({
    uid: user.uid,
    playerName: newName,
    score: 0,
    bestCombo: 0,
    accuracy: 100,
    songsCompleted: 0,
  });
  if (!sanitized) return false;

  const docPath = `scores/${user.uid}`;
  const docRef = doc(db, 'scores', user.uid);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        playerName: sanitized.playerName,
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}
