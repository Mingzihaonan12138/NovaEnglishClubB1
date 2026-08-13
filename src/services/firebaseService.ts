import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, getDocs, getDoc, updateDoc, doc,
  orderBy, onSnapshot, serverTimestamp, setDoc, deleteDoc,
  limit, startAfter, QueryDocumentSnapshot, DocumentData, deleteField 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// NOTE: no getStorage() here. This project has no Firebase Storage bucket
// (verified: the bucket named in firebase-applet-config.json does not exist),
// so student recordings live in Firestore instead — see saveRecordingAudio below.
// Always the (default) database — deliberately NOT firebaseConfig.firestoreDatabaseId.
// AI Studio keeps regenerating that field to point at a private `ai-studio-*`
// database that has no security rules published on it, which makes every read and
// write fail with "Missing or insufficient permissions" while login and the static
// question bank keep working. Hardcoding it here makes those regenerations harmless.
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Headers for calls to our own Express API (/api/*). The server verifies this
 * ID token before spending any Gemini quota.
 */
export async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await auth.currentUser?.getIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function loginWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login error:", error);
  }
}

export async function logout() {
  await auth.signOut();
}

export interface Recording {
  id?: string;
  studentId: string;
  studentEmail: string;
  questionId: string;
  questionText: string;
  topic: string;
  hasAudio?: boolean; // audio lives in the recordingAudio collection under the same id
  audioUrl?: string; // legacy: Firebase Storage download URL
  audioBase64?: string; // legacy: audio inlined into this document
  mimeType?: string; // Crucial for correct playback of base64
  duration?: number; // In seconds
  createdAt: any;
  teacherFeedback?: string;
  status: 'pending' | 'reviewed';
}

/**
 * Firestore caps a single document at 1 MiB. Audio is stored as base64, which
 * inflates the raw bytes by ~33%, so we cap the encoded string well under that
 * to leave room for the other fields. At 24 kbps mono opus this is ~2.9 minutes
 * of speech — far more than a Trinity B1 answer needs.
 */
export const MAX_INLINE_B64 = 700_000;

/**
 * Recordings are split across two collections on purpose:
 *
 *   recordings/{id}      metadata only — small, so listing a student's whole
 *                        history costs almost nothing
 *   recordingAudio/{id}  the base64 audio, fetched only when someone presses play
 *
 * Keeping the audio out of the list documents is what makes this scale to more
 * students: the teacher dashboard can page through hundreds of submissions
 * without downloading a single byte of audio.
 */
export async function saveRecording(recording: Omit<Recording, 'id' | 'createdAt'> & { id?: string; createdAt?: any }) {
  try {
    const { id, audioBase64, ...rest } = recording;
    const data = {
      ...rest,
      createdAt: recording.createdAt || serverTimestamp(),
    };

    if (id) {
      await setDoc(doc(db, 'recordings', id), data, { merge: true });
      return id;
    }
    const created = await addDoc(collection(db, 'recordings'), data);
    return created.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'recordings');
    return null;
  }
}

export async function saveRecordingAudio(
  recordingId: string,
  studentId: string,
  audioBase64: string,
  mimeType: string
) {
  try {
    await setDoc(doc(db, 'recordingAudio', recordingId), {
      studentId,
      audioBase64,
      mimeType,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recordingAudio/${recordingId}`);
  }
}

/** Fetches the audio for one recording. Returns null when there is none. */
export async function loadRecordingAudio(
  recordingId: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const snap = await getDoc(doc(db, 'recordingAudio', recordingId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.audioBase64) return null;
    return { audioBase64: data.audioBase64, mimeType: data.mimeType || 'audio/webm' };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `recordingAudio/${recordingId}`);
    return null;
  }
}

export function subscribeToStudentRecordings(userId: string, callback: (recordings: Recording[]) => void) {
  const q = query(
    collection(db, 'recordings'),
    where('studentId', '==', userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const recordings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording));
    recordings.sort((a, b) => {
      const getMillis = (val: any) => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (val instanceof Date) return val.getTime();
        if (typeof val === 'number') return val;
        // Handle Firestore serverTimestamp placeholder if it somehow gets here
        if (typeof val === 'object' && val.seconds) return val.seconds * 1000;
        return 0;
      };
      return getMillis(b.createdAt) - getMillis(a.createdAt);
    });
    callback(recordings);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'recordings');
  });
}

export async function fetchPaginatedRecordings(pageSize: number, lastDoc: QueryDocumentSnapshot<DocumentData> | null) {
  try {
    let q = query(
      collection(db, 'recordings'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    const recordings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording));
    return {
      recordings,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      size: snapshot.size
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'recordings');
    return { recordings: [], lastDoc: null, size: 0 };
  }
}

export async function updateFeedback(recordingId: string, feedback: string) {
  try {
    const ref = doc(db, 'recordings', recordingId);
    await updateDoc(ref, {
      teacherFeedback: feedback,
      status: 'reviewed'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `recordings/${recordingId}`);
  }
}

/** Frees the space one recording takes up, keeping its metadata and feedback. */
export async function deleteAudioBase64(recordingId: string) {
  try {
    // Legacy documents inlined the audio into the recording itself.
    await updateDoc(doc(db, 'recordings', recordingId), {
      audioBase64: deleteField(),
      hasAudio: false,
    });
    // Current documents keep it in its own collection.
    await deleteDoc(doc(db, 'recordingAudio', recordingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `recordings/${recordingId}`);
  }
}

// Personalized Topics (Part 1)
export interface UserTopic {
  id?: string;
  userId: string;
  topicName: string;
  questions: { id: string; question: string; suggestedAnswer: string }[];
  updatedAt: any;
}

export async function saveUserTopic(topic: Omit<UserTopic, 'id' | 'updatedAt'>) {
  try {
    const q = query(collection(db, 'userTopics'), where('userId', '==', topic.userId), where('topicName', '==', topic.topicName));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = doc(db, 'userTopics', snapshot.docs[0].id);
      await updateDoc(docRef, { ...topic, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'userTopics'), { ...topic, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'userTopics');
  }
}

export function subscribeToUserTopics(userId: string, callback: (topics: UserTopic[]) => void) {
  const q = query(collection(db, 'userTopics'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTopic));
    callback(topics);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'userTopics');
  });
}

// Personalized Conversation Answers (Part 2)
export interface PersonalizedConversation {
  id?: string;
  userId: string;
  topicName: string;
  answers: Record<string, string>; // questionId -> specializedAnswer
  questions?: Record<string, string>; // questionId -> specializedQuestionText
}

export async function savePersonalizedConversation(conv: Omit<PersonalizedConversation, 'id'>) {
  try {
    const q = query(collection(db, 'userConversations'), where('userId', '==', conv.userId), where('topicName', '==', conv.topicName));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = doc(db, 'userConversations', snapshot.docs[0].id);
      await updateDoc(docRef, { ...conv });
    } else {
      await addDoc(collection(db, 'userConversations'), { ...conv });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'userConversations');
  }
}

export function subscribeToPersonalizedConversations(userId: string, callback: (convs: PersonalizedConversation[]) => void) {
  const q = query(collection(db, 'userConversations'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PersonalizedConversation));
    callback(convs);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'userConversations');
  });
}

// User Profiles
export interface UserProfile {
  uid?: string;
  email: string;
  displayName?: string;
  lastActive: any;
  isInvited?: boolean;
}

/**
 * The allowlist is what actually admits a student: firestore.rules only lets an
 * account create its own /users profile if its email has an entry here. The
 * document id IS the lowercased email, because security rules can look a
 * document up by path but cannot run a query.
 */
export async function addToAllowlist(email: string) {
  const key = email.trim().toLowerCase();
  try {
    await setDoc(doc(db, 'allowlist', key), { email: key, addedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `allowlist/${key}`);
  }
}

export async function removeFromAllowlist(email: string) {
  const key = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, 'allowlist', key));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `allowlist/${key}`);
  }
}

export async function saveUserProfile(profile: Omit<UserProfile, 'lastActive'>) {
  try {
    // If we have a UID, update it. If not, we might be pre-inviting by email.
    if (profile.uid) {
      const docRef = doc(db, 'users', profile.uid);
      await setDoc(docRef, { ...profile, lastActive: serverTimestamp() }, { merge: true });
    } else {
      // Find by email if exists, else create new
      const q = query(collection(db, 'users'), where('email', '==', profile.email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), { ...profile, lastActive: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'users'), { ...profile, lastActive: serverTimestamp(), isInvited: true });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid || profile.email}`);
  }
}

/**
 * Creates or refreshes the signed-in user's own profile at users/{uid}.
 *
 * This used to start by querying the whole users collection to find a matching
 * invite. Security rules only allow an admin to list that collection, so for a
 * student the very first call was denied and the profile was never written —
 * every student was running without one. Writing straight to their own document
 * needs no query and is exactly what the rules permit.
 *
 * Returns false when the write was refused, which means the account is not on
 * the teacher's allowlist.
 */
export async function bindUserOnLogin(firebaseUser: User): Promise<boolean> {
  try {
    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        email: (firebaseUser.email || "").toLowerCase(),
        displayName: firebaseUser.displayName || "",
        isInvited: false,
        lastActive: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error("Binding error (account may not be on the allowlist):", error);
    return false;
  }
}

export interface AllowlistEntry {
  email: string;
  addedAt?: any;
}

export function subscribeToAllowlist(callback: (entries: AllowlistEntry[]) => void) {
  return onSnapshot(collection(db, 'allowlist'), (snapshot) => {
    callback(snapshot.docs.map(d => ({ email: d.id, ...d.data() } as AllowlistEntry)));
  }, () => {
    // Students cannot list the allowlist; that is fine, only the teacher needs it.
    callback([]);
  });
}

export function subscribeToAllUsers(callback: (users: UserProfile[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return { ...data, uid: data.uid || doc.id } as UserProfile;
    });
    callback(users);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'users');
  });
}

// Global Content (Templates)
export interface GlobalTopic {
  id?: string;
  topicName: string;
  section: 'Part 1' | 'Part 2';
  questions: { id: string; question: string; suggestedAnswer: string }[];
}

export async function saveGlobalTopic(topic: Omit<GlobalTopic, 'id'>) {
  try {
    const q = query(collection(db, 'globalTopics'), where('topicName', '==', topic.topicName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(doc(db, 'globalTopics', snap.docs[0].id), topic as any);
    } else {
      await addDoc(collection(db, 'globalTopics'), topic);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'globalTopics');
  }
}

export async function deleteGlobalTopic(topicId: string) {
  try {
    await deleteDoc(doc(db, 'globalTopics', topicId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `globalTopics/${topicId}`);
  }
}

export function subscribeToGlobalTopics(callback: (topics: GlobalTopic[]) => void) {
  return onSnapshot(collection(db, 'globalTopics'), (snapshot) => {
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalTopic));
    callback(topics);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'globalTopics');
  });
}

// Clone logic
export async function cloneStudentData(fromUserId: string, toUserId: string) {
  try {
    // Clone Topics (Part 1)
    const topicSnap = await getDocs(query(collection(db, 'userTopics'), where('userId', '==', fromUserId)));
    for (const d of topicSnap.docs) {
      const data = d.data();
      await saveUserTopic({ 
        userId: toUserId,
        topicName: data.topicName,
        questions: data.questions
      });
    }

    // Clone Conversations (Part 2)
    const convSnap = await getDocs(query(collection(db, 'userConversations'), where('userId', '==', fromUserId)));
    for (const d of convSnap.docs) {
      const data = d.data();
      await savePersonalizedConversation({
        userId: toUserId,
        topicName: data.topicName,
        answers: data.answers
      });
    }
  } catch (error) {
    console.error("Cloning error:", error);
  }
}

// Listening Drill Metadata (configured by teacher)
export interface ListeningMetadata {
  id: string; // questionId
  chineseMeaning?: string;
  keywords?: string; // comma separated keywords
  questionType?: string; // preference / frequency / past experience / reason / description, etc.
  slowAudioUrl?: string;
  normalAudioUrl?: string;
}

export async function saveListeningMetadata(meta: ListeningMetadata) {
  try {
    const docRef = doc(db, 'listeningMetadata', meta.id);
    await setDoc(docRef, meta, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `listeningMetadata/${meta.id}`);
  }
}

export function subscribeToListeningMetadata(callback: (metaList: ListeningMetadata[]) => void) {
  return onSnapshot(collection(db, 'listeningMetadata'), (snapshot) => {
    const metaList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListeningMetadata));
    callback(metaList);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'listeningMetadata');
  });
}

/**
 * The listening bank is separate from the speaking material on purpose.
 *
 * Speaking questions are the student's own life (Part 1) or their own answers
 * to the fixed subject areas (Part 2). Listening questions only train the ear,
 * carry nothing personal, and are expensive for the teacher to prepare, so one
 * shared bank is reused across students.
 *
 * Who may practise what is kept in listeningAssignments, NOT on the user
 * document: a student can write their own users/{uid} doc, so an assignment
 * field living there would be self-serviceable.
 */
export interface ListeningQuestion {
  id?: string;
  text: string;
  chineseMeaning?: string;
  keywords?: string;
  questionType?: string;
  slowAudioUrl?: string;
  normalAudioUrl?: string;
  createdAt?: any;
}

export async function saveListeningQuestion(q: ListeningQuestion) {
  try {
    if (q.id) {
      const { id, ...rest } = q;
      await setDoc(doc(db, 'listeningQuestions', id), rest, { merge: true });
      return id;
    }
    const created = await addDoc(collection(db, 'listeningQuestions'), {
      ...q,
      createdAt: serverTimestamp(),
    });
    return created.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'listeningQuestions');
    return null;
  }
}

export async function deleteListeningQuestion(questionId: string) {
  try {
    await deleteDoc(doc(db, 'listeningQuestions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `listeningQuestions/${questionId}`);
  }
}

export function subscribeToListeningQuestions(callback: (qs: ListeningQuestion[]) => void) {
  return onSnapshot(collection(db, 'listeningQuestions'), (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ListeningQuestion)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'listeningQuestions');
  });
}

export interface ListeningAssignment {
  userId: string;
  questionIds: string[];
  updatedAt?: any;
}

/** Teacher only. Replaces the whole set a student may practise. */
export async function setListeningAssignment(userId: string, questionIds: string[]) {
  try {
    await setDoc(doc(db, 'listeningAssignments', userId), {
      userId,
      questionIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `listeningAssignments/${userId}`);
  }
}

export function subscribeToListeningAssignment(
  userId: string,
  callback: (questionIds: string[]) => void
) {
  return onSnapshot(doc(db, 'listeningAssignments', userId), (snap) => {
    callback(snap.exists() ? (snap.data().questionIds || []) : []);
  }, () => {
    // No assignment yet is a normal state, not an error worth shouting about.
    callback([]);
  });
}

// Student Listening Drill Progress tracking
export interface ListeningProgress {
  id?: string;
  studentId: string;
  studentEmail: string;
  questionId: string;
  topic: string;
  completedModes: string[]; // ['meaning', 'keywords', 'type', 'respond']
  createdAt: any;
}

export async function saveListeningProgress(progress: Omit<ListeningProgress, 'id' | 'createdAt'> & { id?: string; createdAt?: any }) {
  try {
    const docRef = doc(db, 'listeningProgress', `${progress.studentId}_${progress.questionId}`);
    await setDoc(docRef, {
      ...progress,
      createdAt: progress.createdAt || serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `listeningProgress/${progress.studentId}_${progress.questionId}`);
  }
}

export function subscribeToStudentListeningProgress(userId: string, callback: (progress: ListeningProgress[]) => void) {
  const q = query(collection(db, 'listeningProgress'), where('studentId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const progress = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListeningProgress));
    callback(progress);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'listeningProgress');
  });
}

// Student custom marked items ("Need Practice")
export interface ListeningMarked {
  id?: string;
  userId: string;
  studentEmail: string;
  questionId: string;
  topic: string;
  marked: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export async function saveListeningMark(mark: Omit<ListeningMarked, 'createdAt' | 'updatedAt'> & { createdAt?: any; updatedAt?: any }) {
  try {
    const docId = `${mark.userId}_${mark.questionId}`;
    const docRef = doc(db, 'listeningMarked', docId);
    await setDoc(docRef, {
      ...mark,
      createdAt: mark.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `listeningMarked/${mark.userId}_${mark.questionId}`);
  }
}

export function subscribeToStudentListeningMarks(userId: string, callback: (marks: ListeningMarked[]) => void) {
  const q = query(collection(db, 'listeningMarked'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const marks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListeningMarked));
    callback(marks);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'listeningMarked');
  });
}

export function subscribeToAllListeningMarks(callback: (marks: ListeningMarked[]) => void) {
  const q = collection(db, 'listeningMarked');
  return onSnapshot(q, (snapshot) => {
    const marks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListeningMarked));
    callback(marks);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'listeningMarked');
  });
}

// Mascot Custom Dynamic Configuration
export interface MascotSettings {
  useCustomImage: boolean;
  customImageBase64?: string;
  customSpeechBubble?: string;
  mascotName?: string;
  avatarScale?: number;
}

export async function saveMascotSettings(settings: MascotSettings) {
  try {
    const docRef = doc(db, 'settings', 'mascot');
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/mascot');
  }
}

export function subscribeToMascotSettings(callback: (settings: MascotSettings | null) => void) {
  return onSnapshot(doc(db, 'settings', 'mascot'), (snapshot) => {
    if (snapshot.exists()) {
      callback({ ...snapshot.data() } as MascotSettings);
    } else {
      callback(null);
    }
  }, (error) => {
    // Gracefully fallback on missing permission / database lock
    console.warn("Mascot settings lookup disabled or requires proper setup.");
    callback(null);
  });
}

