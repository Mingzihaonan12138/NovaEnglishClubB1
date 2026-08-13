import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, 
  orderBy, onSnapshot, serverTimestamp, getDocFromServer, setDoc, deleteDoc, 
  limit, startAfter, QueryDocumentSnapshot, DocumentData, deleteField 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

// Test connection CRITICAL
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

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
  audioUrl?: string; // Optional because legacy might use audioBase64
  audioBase64?: string; // Support for legacy or direct base64
  mimeType?: string; // Crucial for correct playback of base64
  duration?: number; // In seconds
  createdAt: any;
  teacherFeedback?: string;
  status: 'pending' | 'reviewed';
}

export async function uploadAudio(blob: Blob, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
}

export async function saveRecording(recording: Omit<Recording, 'id' | 'createdAt'> & { id?: string; createdAt?: any }) {
  try {
    const { id, ...rest } = recording;
    const data = {
      ...rest,
      createdAt: recording.createdAt || serverTimestamp(),
    };
    
    if (id) {
      // Use setDoc if id is provided
      await setDoc(doc(db, 'recordings', id), data, { merge: true });
    } else {
      await addDoc(collection(db, 'recordings'), data);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'recordings');
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

export async function deleteAudioBase64(recordingId: string) {
  try {
    const ref = doc(db, 'recordings', recordingId);
    await updateDoc(ref, {
      audioBase64: deleteField()
    });
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

// Bind pre-invited user on first login
export async function bindUserOnLogin(firebaseUser: User) {
  try {
    const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const existingDoc = snap.docs[0];
      const data = existingDoc.data();
      
      // If the email matches but the document was created via "Invite" (doc ID is auto, lacks UID field or uses different ID)
      // We should ideally use the UID as the document ID for consistency.
      if (existingDoc.id !== firebaseUser.uid) {
        // Move the data to the correct UID path
        const newDocRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(newDocRef, {
          ...data,
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || data.displayName || "",
          isInvited: false, // Now officially registered
          lastActive: serverTimestamp()
        });
        // Delete old entry
        await deleteDoc(existingDoc.ref);
      }
    } else {
      // Standard registration
      await saveUserProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || "",
        isInvited: false
      });
    }
  } catch (error) {
    console.error("Binding error:", error);
  }
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

