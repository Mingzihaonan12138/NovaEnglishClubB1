import { useState, useRef, useEffect } from 'react';
import { 
  Mic, Square, Volume2, Play, Pause, CheckCircle2, RefreshCcw, BookOpen, 
  Settings, X, Trash2, Save, LogIn, LogOut, User, MessageSquare,
  Plus, Search, Users, FileText, Download, Copy, ChevronRight,
  AlertCircle, Upload, Wand2, Loader2, Headphones
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { B1_QUESTIONS, TRINITY_B1_TOPICS, QuestionAnswer, TOPIC_EXPANSION_BANK } from './constants';
import { speakQuestion } from './services/geminiService';
import { 
  auth, loginWithGoogle, logout, saveRecording, 
  subscribeToStudentRecordings,
  updateFeedback, Recording, UserTopic, PersonalizedConversation,
  saveUserTopic, savePersonalizedConversation,
  subscribeToUserTopics, subscribeToPersonalizedConversations,
  saveUserProfile, subscribeToAllUsers, UserProfile,
  subscribeToGlobalTopics, saveGlobalTopic, deleteGlobalTopic, GlobalTopic,
  bindUserOnLogin, cloneStudentData, db, fetchPaginatedRecordings,
  deleteAudioBase64, saveRecordingAudio, loadRecordingAudio, MAX_INLINE_B64,
  addToAllowlist, subscribeToAllowlist, AllowlistEntry, subscribeToMyEnrolment,
  ListeningMetadata, ListeningProgress, saveListeningMetadata,
  subscribeToListeningMetadata, saveListeningProgress,
  subscribeToStudentListeningProgress,
  ListeningMarked, saveListeningMark,
  subscribeToStudentListeningMarks, subscribeToAllListeningMarks,
  ListeningQuestion, subscribeToListeningQuestions, subscribeToListeningAssignment,
  deleteUserTopic, newQuestionId,
  apiHeaders
} from './services/firebaseService';
import ListeningDrill from './components/ListeningDrill';
import ListeningSetupPanel from './components/ListeningSetupPanel';
import Mascot, { StarMascot } from './components/Mascot';
import PracticeDeck, { DeckCardState } from './components/PracticeDeck';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, getDocs, doc, updateDoc, serverTimestamp, QueryDocumentSnapshot, DocumentData, where } from 'firebase/firestore';

/**
 * One colour per deck, so a card back is recognisable before it is turned over.
 * Derived from the topic name so a newly added topic gets a stable colour with
 * no extra configuration. The colour only ever appears on card backs and deck
 * covers, never in the answering view.
 */
const DECK_COLOURS = ['#455da3', '#7a8c4e', '#b4693a', '#6d7f96', '#8a6aa1', '#a8794e'];
function deckColour(topic: string): string {
  let h = 0;
  for (let i = 0; i < topic.length; i++) h = (h * 31 + topic.charCodeAt(i)) >>> 0;
  return DECK_COLOURS[h % DECK_COLOURS.length];
}

export default function App() {
  // Starts empty rather than at a constant's first entry, which was the name of
  // a real student's topic and showed up before any content had loaded.
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<QuestionAnswer | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimeRef = useRef(0);

  useEffect(() => {
    setShowAnswer(false);
  }, [currentQuestion?.id]);
  useEffect(() => {
    recordingTimeRef.current = recordingTime;
  }, [recordingTime]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [userTopics, setUserTopics] = useState<UserTopic[]>([]);
  const [userConvs, setUserConvs] = useState<PersonalizedConversation[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  /** Signed in is not the same as taken on. Only enrolled accounts submit work. */
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [globalTopics, setGlobalTopics] = useState<GlobalTopic[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  
  const [selectedRecordingsStudentEmail, setSelectedRecordingsStudentEmail] = useState<string | null>(null);
  const [recordingStudentSearch, setRecordingStudentSearch] = useState("");
  const [activeStudentRecordings, setActiveStudentRecordings] = useState<Recording[]>([]);
  const [isLoadingActiveStudent, setIsLoadingActiveStudent] = useState(false);

  const formatTimestamp = (createdAt: any) => {
    if (!createdAt) return "";
    let ms = 0;
    if (typeof createdAt.toMillis === 'function') ms = createdAt.toMillis();
    else if (createdAt instanceof Date) ms = createdAt.getTime();
    else if (typeof createdAt === 'number') ms = createdAt;
    else if (typeof createdAt === 'object' && createdAt.seconds) ms = createdAt.seconds * 1000;
    else return "";

    const d = new Date(ms);
    return d.toLocaleString('zh-CN', { hour12: false });
  };

  const getLastSubmittedText = (recs: Recording[]) => {
    if (recs.length === 0) return "";
    const times = recs.map(r => {
      if (!r.createdAt) return 0;
      if (typeof r.createdAt.toMillis === 'function') return r.createdAt.toMillis();
      if (r.createdAt instanceof Date) return r.createdAt.getTime();
      if (typeof r.createdAt === 'number') return r.createdAt;
      if (typeof r.createdAt === 'object' && r.createdAt.seconds) return r.createdAt.seconds * 1000;
      return 0;
    }).filter(t => t > 0);
    
    if (times.length === 0) return "";
    const maxTime = Math.max(...times);
    const diffMs = Date.now() - maxTime;
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleStudentClick = async (email: string) => {
    setSelectedRecordingsStudentEmail(email);
    setIsLoadingActiveStudent(true);
    try {
      const q = query(
        collection(db, 'recordings'),
        where('studentEmail', '==', email)
      );
      const snap = await getDocs(q);
      const recs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording));
      
      recs.sort((a, b) => {
        const getTs = (r: Recording) => {
          if (!r.createdAt) return 0;
          if (typeof r.createdAt.toMillis === 'function') return r.createdAt.toMillis();
          if (r.createdAt instanceof Date) return r.createdAt.getTime();
          if (typeof r.createdAt === 'number') return r.createdAt;
          if (typeof r.createdAt === 'object' && r.createdAt.seconds) return r.createdAt.seconds * 1000;
          return 0;
        };
        return getTs(b) - getTs(a);
      });
      
      setActiveStudentRecordings(recs);
    } catch (e) {
      console.error("Error fetching recordings for selected student email:", email, e);
    } finally {
      setIsLoadingActiveStudent(false);
    }
  };
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [adminTab, setAdminTab] = useState<'students' | 'content' | 'recovery' | 'listeningSetup'>('students');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{[key: string]: string}>({});
  const [lastRecordingDoc, setLastRecordingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreRecordings, setHasMoreRecordings] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // New Listening Drill related states
  const [listeningQuestions, setListeningQuestions] = useState<ListeningQuestion[]>([]);
  const [assignedListeningIds, setAssignedListeningIds] = useState<string[]>([]);
  const [listeningMetadata, setListeningMetadata] = useState<ListeningMetadata[]>([]);
  const [listeningProgress, setListeningProgress] = useState<ListeningProgress[]>([]);
  const [listeningMarks, setListeningMarks] = useState<ListeningMarked[]>([]);
  const [activeModule, setActiveModule] = useState<'listening' | 'speaking' | null>(null);
  /** Which Part 1 topic is open as a deck, if any. */
  const [activeDeck, setActiveDeck] = useState<string | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'part1' | 'part2'>('part1');
  const [importJson, setImportJson] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState("");

  // Audio is fetched per recording on first play; keep it around so replaying
  // the same submission doesn't cost another Firestore read.
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioCacheRef = useRef<Record<string, string>>({});

  /** The card that was on screen when recording started. See handleSave. */
  const recordingQuestionRef = useRef<QuestionAnswer | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && u.email) {
        const email = u.email.toLowerCase();
        setIsAdmin(email === 'xuanyu.diao@gmail.com' || email === 'aitonghan02@gmail.com');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setRecordings([]);
      return;
    }

    bindUserOnLogin(user);

    let unsubscribe: any;
    let unsubscribeTopics: any;
    let unsubscribeConvs: any;
    let unsubscribeUsers: any;
    let unsubscribeAllowlist: any;
    let unsubscribeGlobal: any;
    let unsubscribeListeningMeta: any;
    let unsubscribeListeningBank: any;
    let unsubscribeEnrolment: any;
    let unsubscribeListeningAssign: any;
    let unsubscribeListeningProg: any;
    let unsubscribeListeningMarks: any;

    unsubscribeGlobal = subscribeToGlobalTopics((data) => setGlobalTopics(data));
    unsubscribeListeningMeta = subscribeToListeningMetadata((data) => setListeningMetadata(data));
    unsubscribeListeningBank = subscribeToListeningQuestions((data) => setListeningQuestions(data));
    if (user.email) {
      unsubscribeEnrolment = subscribeToMyEnrolment(user.email, (ok) => setIsEnrolled(ok || isAdmin));
    }
    unsubscribeListeningAssign = subscribeToListeningAssignment(user.uid, (ids) => setAssignedListeningIds(ids));

    if (user) {
      unsubscribeListeningProg = subscribeToStudentListeningProgress(user.uid, (data) => setListeningProgress(data));
      if (isAdmin) {
        unsubscribeListeningMarks = subscribeToAllListeningMarks((data) => setListeningMarks(data));
      } else {
        unsubscribeListeningMarks = subscribeToStudentListeningMarks(user.uid, (data) => setListeningMarks(data));
      }
    }

    if (isAdmin) {
      // For Admin, we do paginated fetch for the main list instead of real-time subscription
      // to handle large datasets efficiently.
      const initialFetch = async () => {
        const result = await fetchPaginatedRecordings(20, null);
        setRecordings(result.recordings);
        setLastRecordingDoc(result.lastDoc);
        setHasMoreRecordings(result.recordings.length === 20);
      };
      initialFetch();

      unsubscribeUsers = subscribeToAllUsers((data) => setAllUsers(data));
      unsubscribeAllowlist = subscribeToAllowlist((data) => setAllowlist(data));

      if (selectedStudentId) {
        unsubscribeTopics = subscribeToUserTopics(selectedStudentId, (data) => setUserTopics(data));
        unsubscribeConvs = subscribeToPersonalizedConversations(selectedStudentId, (data) => setUserConvs(data));
      }
    } else if (user) {
      unsubscribe = subscribeToStudentRecordings(user.uid, (data) => setRecordings(data));
      unsubscribeTopics = subscribeToUserTopics(user.uid, (data) => setUserTopics(data));
      unsubscribeConvs = subscribeToPersonalizedConversations(user.uid, (data) => setUserConvs(data));
    }

    return () => {
      unsubscribe && unsubscribe();
      unsubscribeTopics && unsubscribeTopics();
      unsubscribeConvs && unsubscribeConvs();
      unsubscribeUsers && unsubscribeUsers();
      unsubscribeAllowlist && unsubscribeAllowlist();
      unsubscribeGlobal && unsubscribeGlobal();
      unsubscribeListeningMeta && unsubscribeListeningMeta();
      unsubscribeListeningBank && unsubscribeListeningBank();
      unsubscribeEnrolment && unsubscribeEnrolment();
      unsubscribeListeningAssign && unsubscribeListeningAssign();
      unsubscribeListeningProg && unsubscribeListeningProg();
      unsubscribeListeningMarks && unsubscribeListeningMarks();
    };
  }, [user, isAdmin, selectedStudentId]);

  /**
   * Builds the question list this signed-in student is allowed to see.
   *
   * The exam has two parts and they are sourced differently:
   *
   *   Part 1  the five topics the student chose with their teacher. These are
   *           somebody's actual life, so they come ONLY from that student's own
   *           userTopics documents. Never from a shared bank.
   *
   *   Part 2  the fixed Trinity subject areas. The questions are the same for
   *           everyone, so they come from globalTopics, but the model answer is
   *           personal and comes ONLY from that student's userConversations.
   *           With no personal answer we show none — showing the shared one
   *           would hand this student another student's life.
   *
   * B1_QUESTIONS in constants.ts is one specific student's prepared material.
   * It is demo content for the teacher's own account, never student-facing.
   */
  const getDisplayQuestions = () => {
    // Part 1 — strictly per-student.
    const part1: QuestionAnswer[] = [];
    userTopics.forEach(t => {
      t.questions.forEach(q => {
        part1.push({
          ...q,
          topic: t.topicName,
          section: 'Part 1',
          audioUrl: `/audio/${q.id}.wav`,
        } as QuestionAnswer);
      });
    });

    // Part 2 — shared questions, personal answers.
    const part2: QuestionAnswer[] = [];
    const seenTopics = new Set<string>();
    globalTopics.forEach(gt => {
      const key = gt.topicName.trim().toLowerCase();
      if (seenTopics.has(key)) return;
      seenTopics.add(key);

      const conv = userConvs.find(c => c.topicName === gt.topicName);
      gt.questions.forEach(q => {
        part2.push({
          ...q,
          topic: gt.topicName,
          section: gt.section || 'Part 2',
          // The student's own wording of the question, if the teacher wrote one.
          question: conv?.questions?.[q.id] || q.question,
          // Their own answer, or nothing at all.
          suggestedAnswer: conv?.answers?.[q.id] || '',
          audioUrl: `/audio/${q.id}.wav`,
        } as QuestionAnswer);
      });
    });

    // With no content set up yet the teacher would face an empty app and have
    // nothing to click, so they fall back to the bundled sample. It is one
    // former student's real prepared material, so it must be unmistakably
    // labelled — see the banner keyed off isShowingSampleData. Students never
    // reach this branch.
    const usingSample = part1.length === 0 && part2.length === 0 && isAdmin;

    // The bundled bank predates the section field, so tag it on the way past.
    // Its Part 1 topics are exactly the sub-topics of the expansion bank's main
    // topic; everything else is a published Trinity subject area. Without this
    // the sample yields no Part 1 decks and the card deck has no entry point.
    const samplePart1Topics = new Set(
      (TOPIC_EXPANSION_BANK?.[0]?.smallTopics || []).map(t => t.trim().toLowerCase())
    );
    const customizedList = usingSample
      ? B1_QUESTIONS.map(q => ({
          ...q,
          section: samplePart1Topics.has(q.topic.trim().toLowerCase())
            ? ('Part 1' as const)
            : ('Part 2' as const),
        }))
      : [...part1, ...part2];

    // 3. Final visual and functional de-duplication: filter out questions that resolve to identical texts
    // to prevent students from having repetitive items ("Next" going to what appears as the same question)
    const finalUniqueMap = new Map<string, QuestionAnswer>();
    customizedList.forEach(q => {
      const cleanText = q.question.indexOf('(') !== -1 
        ? q.question.slice(0, q.question.indexOf('(')).trim() 
        : q.question.trim();
      const uniqueKey = `${q.topic.toLowerCase()}_${cleanText.toLowerCase()}`;
      if (!finalUniqueMap.has(uniqueKey)) {
        finalUniqueMap.set(uniqueKey, q);
      }
    });

    return Array.from(finalUniqueMap.values());
  };

  const displayQuestions = getDisplayQuestions();

  /**
   * Everything the deck needs to weight a draw, gathered from data the app
   * already keeps: when the student last recorded an answer, whether they
   * flagged the card, and the keywords the teacher wrote for it.
   */
  const deckCardState: Record<string, DeckCardState> = (() => {
    const map: Record<string, DeckCardState> = {};
    const at = (v: any) =>
      !v ? 0
      : typeof v.toMillis === 'function' ? v.toMillis()
      : v instanceof Date ? v.getTime()
      : typeof v === 'number' ? v
      : typeof v === 'object' && v.seconds ? v.seconds * 1000
      : 0;

    recordings.forEach(r => {
      const ms = at(r.createdAt);
      const prev = map[r.questionId] || {};
      if (!prev.lastPractisedAt || ms > prev.lastPractisedAt) {
        map[r.questionId] = { ...prev, lastPractisedAt: ms };
      }
      if (r.teacherFeedback && r.status === 'reviewed') {
        map[r.questionId] = { ...map[r.questionId], feedback: r.teacherFeedback };
      }
    });
    listeningMarks.forEach(m => {
      if (m.marked) map[m.questionId] = { ...(map[m.questionId] || {}), marked: true };
    });
    listeningMetadata.forEach(m => {
      if (m.keywords) map[m.id] = { ...(map[m.id] || {}), keywords: m.keywords };
    });
    return map;
  })();

  const deckQuestions = activeDeck
    ? displayQuestions.filter(q => q.topic === activeDeck)
    : [];

  /**
   * True when the teacher is looking at the bundled sample rather than at real
   * content. Worth saying out loud: the sample is one former student's actual
   * family, and seeing it unlabelled looks exactly like a privacy leak.
   */
  const isShowingSampleData = isAdmin && userTopics.length === 0 && globalTopics.length === 0;

  /** The Part 1 topics belonging to whichever student the teacher is editing. */
  const studentPart1Topics = userTopics.map(t => t.topicName);

  const addPart1Topic = async () => {
    const name = newTopicName.trim();
    if (!name || !selectedStudentId) return;
    if (studentPart1Topics.some(t => t.toLowerCase() === name.toLowerCase())) {
      alert(`「${name}」已经有了。`);
      return;
    }
    await saveUserTopic({ userId: selectedStudentId, topicName: name, questions: [] });
    setSelectedTopic(name);
    setNewTopicName('');
  };

  /**
   * Part 1 topics sitting in the shared library that this student does not have
   * yet. Each student picks their own five, so the library is a menu to draw
   * from rather than something applied wholesale.
   */
  const addableLibraryTopics = globalTopics
    .filter(gt => gt.section === 'Part 1')
    .filter(gt => !studentPart1Topics.some(t => t.toLowerCase() === gt.topicName.toLowerCase()));

  const addTopicFromLibrary = async (gt: GlobalTopic) => {
    if (!selectedStudentId) return;
    // Questions and model answers both come across; the answers are a draft for
    // the teacher to rewrite in this student's own words.
    await saveUserTopic({
      userId: selectedStudentId,
      topicName: gt.topicName,
      questions: gt.questions,
    });
    setSelectedTopic(gt.topicName);
  };

  const addPart1Question = async () => {
    if (!selectedStudentId || !selectedTopic) return;
    const topic = userTopics.find(t => t.topicName === selectedTopic);
    const questions = [...(topic?.questions || []),
      { id: newQuestionId('p1'), question: '', suggestedAnswer: '' }];
    await saveUserTopic({ userId: selectedStudentId, topicName: selectedTopic, questions });
  };

  /**
   * Adds a blank question to a shared Part 2 subject area. These live in
   * globalTopics because the questions are the same for every candidate; only
   * the answers, kept in userConversations, are personal.
   */
  const addPart2Question = async (topic: string) => {
    const existing = globalTopics.find(gt => gt.topicName === topic);
    const questions = [...(existing?.questions || []),
      { id: newQuestionId('p2'), question: '', suggestedAnswer: '' }];
    await saveGlobalTopic({ topicName: topic, section: 'Part 2', questions });
  };

  /** One deck per Part 1 topic, with just enough state for the cover. */
  const part1Decks = (() => {
    const byTopic = new Map<string, QuestionAnswer[]>();
    displayQuestions
      .filter(q => q.section === 'Part 1')
      .forEach(q => {
        const list = byTopic.get(q.topic) || [];
        list.push(q);
        byTopic.set(q.topic, list);
      });
    return Array.from(byTopic.entries()).map(([topic, qs]) => ({
      topic,
      total: qs.length,
      fresh: qs.filter(q => !deckCardState[q.id]?.lastPractisedAt).length,
    }));
  })();

  const startRecordingFor = (q: QuestionAnswer) => {
    setCurrentQuestion(q);
    recordingQuestionRef.current = q;
    startRecording();
  };

  const toggleMark = async (q: QuestionAnswer) => {
    if (!user) return;
    const now = deckCardState[q.id]?.marked === true;
    await saveListeningMark({
      userId: user.uid,
      studentEmail: user.email || 'unknown',
      questionId: q.id,
      topic: q.topic,
      marked: !now,
    });
  };

  /**
   * What this student may practise in the listening drill: the shared bank
   * narrowed to what the teacher assigned them. The drill component speaks
   * QuestionAnswer, so the bank is adapted to that shape here rather than
   * reworking 2,600 lines of drill UI.
   *
   * The teacher sees the whole bank so they can try any item out.
   */
  const listeningDrillQuestions: QuestionAnswer[] = (() => {
    const allowed = isAdmin
      ? listeningQuestions
      : listeningQuestions.filter(q => q.id && assignedListeningIds.includes(q.id));

    return allowed.map(q => ({
      id: q.id!,
      topic: q.questionType || 'Listening',
      question: q.text,
      suggestedAnswer: '',
      audioUrl: q.normalAudioUrl || `/audio/${q.id}.wav`,
      chineseMeaning: q.chineseMeaning,
    }));
  })();

  const getQuestionTextById = (questionId: string) => {
    // 1. Check displayQuestions (topic questions)
    const topicQ = displayQuestions.find(q => q.id === questionId);
    if (topicQ) {
       return {
         text: topicQ.question,
         chinese: topicQ.chineseMeaning || '',
         type: 'Listening Drill',
         topic: topicQ.topic
       };
    }
    // 2. Check TOPIC_EXPANSION_BANK (expansion questions)
    for (const exp of TOPIC_EXPANSION_BANK) {
       const expQ = exp.expansionQuestions.find(q => q.id === questionId);
       if (expQ) {
          return {
            text: expQ.question,
            chinese: expQ.chineseMeaning || '',
            type: `Expansion - ${expQ.category}`,
            topic: exp.mainTopic
          };
       }
    }
    return { text: `Question ${questionId}`, chinese: '', type: 'Listening', topic: 'General' };
  };
  
  // Teachers pick from the students who have signed in, plus anyone who has been
  // allowlisted but hasn't logged in yet (shown as "Pre-registered").
  const students = (() => {
    const joined = allUsers.filter(u => u.uid !== user?.uid);
    const joinedEmails = new Set(joined.map(u => (u.email || "").toLowerCase()));
    const pending: UserProfile[] = allowlist
      .filter(a => !joinedEmails.has(a.email) && a.email !== user?.email?.toLowerCase())
      .map(a => ({ email: a.email, isInvited: true, lastActive: null }));
    return [...joined, ...pending];
  })();

  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  const [isGeneratingItem, setIsGeneratingItem] = useState<string | null>(null);

  const generateSingleAudio = async (id: string, text: string) => {
    setIsGeneratingItem(id);
    try {
      const response = await fetch('/api/admin/generate-audio-single', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({ id, text })
      });
      if (!response.ok) throw new Error("Failed to generate");
      setGenStatus(`Voice generated for item: ${id}`);
      setTimeout(() => setGenStatus(""), 3000);
    } catch (err: any) {
      alert("Voice generation failed: " + err.message);
    } finally {
      setIsGeneratingItem(null);
    }
  };

  const bulkGenerateAudio = async () => {
    if (!isAdmin) return;
    setIsGeneratingAudio(true);
    setGenStatus("Connecting to server...");

    const questionsToGen = [];
    globalTopics.forEach(gt => {
      gt.questions.forEach(q => {
        questionsToGen.push({ id: q.id, text: q.question });
      });
    });
    
    try {
      const response = await fetch('/api/admin/generate-audio-batch', {
        method: 'POST',
        headers: await apiHeaders(),
        body: JSON.stringify({ questions: questionsToGen })
      });

      if (!response.ok) throw new Error("Server failed to generate audio");
      
      const result = await response.json();
      setGenStatus(`Success! Generated ${result.results.length} files.`);
      setTimeout(() => setGenStatus(""), 5000);
    } catch (err: any) {
      console.error(err);
      setGenStatus(`Error: ${err.message}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleImportPreview = () => {
    setImportError("");
    try {
      const parsed = JSON.parse(importJson);
      if (importType === 'part1') {
        if (!Array.isArray(parsed)) throw new Error("Expected an array of question objects");
        if (parsed.length > 0 && (!parsed[0].id || !parsed[0].question)) {
          throw new Error("Invalid format. Expected: [{id: '...', question: '...', suggestedAnswer: '...'}]");
        }
      } else {
        if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error("Expected a JSON object (Topic-to-Answers map)");
        // Example: { "QuestionId": "Personal Answer" }
      }
      setImportPreview(Array.isArray(parsed) ? parsed : Object.entries(parsed));
    } catch (e: any) {
      setImportError(e.message || "Invalid JSON format");
      setImportPreview([]);
    }
  };

  const executeImport = async () => {
    if (!selectedStudentId || !importPreview.length) return;
    
    try {
      if (importType === 'part1') {
        await saveUserTopic({
          userId: selectedStudentId,
          topicName: selectedTopic,
          questions: importPreview
        });
      } else {
        // Find existing or start new
        const answers: Record<string, string> = {};
        importPreview.forEach(([id, ans]) => {
          answers[id] = ans;
        });
        
        await savePersonalizedConversation({
          userId: selectedStudentId,
          topicName: selectedTopic,
          answers: answers
        });
      }
      setShowImportModal(false);
      setImportJson("");
      setImportPreview([]);
      alert("Import Successful!");
    } catch (e: any) {
      alert("Import Failed: " + e.message);
    }
  };

  // Filter questions by topic and keep their index for numbering
  const filteredQuestions = displayQuestions.filter(q => q.topic === selectedTopic);

  /**
   * Topic lists come from this student's own questions, never from a constant.
   *
   * These used to be the literal array
   * ["My daughter", "My cats", "My husband", "Family activities", "My house"],
   * rendered to whoever was signed in. Isolating the question text was not
   * enough: the topic names alone told every visitor that some student has a
   * daughter, a husband, cats and a house.
   */
  const topicsIn = (section: 'Part 1' | 'Part 2') =>
    Array.from(new Set(
      displayQuestions
        .filter(q => (section === 'Part 1' ? q.section === 'Part 1' : q.section !== 'Part 1'))
        .map(q => q.topic)
    ));

  const part1Topics = topicsIn('Part 1');
  const part2Topics = topicsIn('Part 2');

  const stopAllPlayback = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setPlayingRecordingId(null);
    setIsPlaying(false);
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const loadMoreRecordings = async () => {
    if (isLoadingMore || !hasMoreRecordings) return;
    setIsLoadingMore(true);
    const result = await fetchPaginatedRecordings(20, lastRecordingDoc);
    if (result.recordings.length > 0) {
      setRecordings(prev => [...prev, ...result.recordings]);
      setLastRecordingDoc(result.lastDoc);
      setHasMoreRecordings(result.recordings.length === 20);
    } else {
      setHasMoreRecordings(false);
    }
    setIsLoadingMore(false);
  };

  const startRecording = async () => {
    if (!user) {
      alert("Please login first to record and save your answer.");
      return;
    }
    
    // Stop any playing audio before recording
    stopAllPlayback();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      streamRef.current = stream;

      // Determine supported MIME type
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac'
      ].find(type => MediaRecorder.isTypeSupported(type)) || '';

      // 24 kbps mono opus is plenty for speech and keeps a 45s answer around
      // 180 KB once base64-encoded, well inside the Firestore document limit.
      const options: MediaRecorderOptions = {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 24000,
      };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        await handleSave(audioBlob, actualMimeType, recordingTimeRef.current);
        
        // Stop all tracks to release the microphone correctly
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Please allow microphone access. Tip: Use headphones for better quality.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the recording."));
      reader.onload = () => {
        const result = String(reader.result);
        // strip the "data:audio/webm;base64," prefix
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.readAsDataURL(blob);
    });

  const handleSave = async (audioBlob: Blob, mimeType: string, duration: number) => {
    // The deck can move to a new card between starting and stopping a
    // recording, so the question is captured in a ref when recording begins
    // rather than read from state when it ends.
    const q = recordingQuestionRef.current || currentQuestion;
    if (!q || !user) return;

    // Visitors may record and listen back to themselves, but nothing leaves the
    // browser. Uploads are the only expensive write in this app, so they are
    // reserved for students the teacher has actually taken on.
    if (!isEnrolled) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => URL.revokeObjectURL(url));
      return;
    }

    setIsSaving(true);
    try {
      const audioBase64 = await blobToBase64(audioBlob);

      // Refuse loudly rather than saving a recording the teacher can never play.
      if (audioBase64.length > MAX_INLINE_B64) {
        alert(
          `录音太长了（约 ${Math.round(duration)} 秒），无法保存。\n` +
          `请控制在 2 分半以内后重新录制。`
        );
        return;
      }

      // 1. Metadata first — this is what the teacher's dashboard lists.
      const recordingId = await saveRecording({
        studentId: user.uid,
        studentEmail: user.email || 'unknown',
        questionId: q.id,
        questionText: q.question,
        topic: q.topic,
        hasAudio: true,
        mimeType: mimeType,
        duration: duration,
        status: 'pending'
      });
      if (!recordingId) throw new Error("Could not create the submission record.");

      // 2. Audio in its own document, fetched only when someone plays it.
      await saveRecordingAudio(recordingId, user.uid, audioBase64, mimeType);

      alert("Saved! Your teacher will review it soon.");
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Failed to save recording: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const playQuestion = async () => {
    if (!currentQuestion) return;
    
    stopAllPlayback();
    setIsSpeaking(true);
    
    try {
      await speakQuestion(currentQuestion.question, currentQuestion.audioUrl);
    } catch (err: any) {
      console.error("Audio playback failed:", err);
      // Fallback is already handled inside speakQuestion, but just in case:
      try {
        const { speakQuestion: speak } = await import('./services/geminiService');
        await speak(currentQuestion.question);
      } catch (innerErr) {
        alert("Audio playback failed completely.");
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  const playRecording = async (rec: Recording) => {
    if (!rec.id) return;

    // Toggle logic for current recording
    if (playingRecordingId === rec.id && currentAudioRef.current) {
      if (isPlaying) {
        currentAudioRef.current.pause();
        setIsPlaying(false);
      } else {
        currentAudioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
      return;
    }

    stopAllPlayback();

    let audioSrc = "";

    try {
      if (rec.audioUrl) {
        // Legacy: audio was uploaded to Firebase Storage.
        audioSrc = rec.audioUrl;
      } else if (rec.audioBase64) {
        // Legacy: audio was inlined into the recording document itself.
        audioSrc = rec.audioBase64.startsWith('data:audio/')
          ? rec.audioBase64
          : `data:${rec.mimeType || 'audio/webm'};base64,${rec.audioBase64}`;
      } else if (audioCacheRef.current[rec.id]) {
        audioSrc = audioCacheRef.current[rec.id];
      } else {
        // Current: audio lives in its own document, fetched on demand.
        setLoadingAudioId(rec.id);
        const stored = await loadRecordingAudio(rec.id);
        setLoadingAudioId(null);
        if (!stored) {
          alert("No audio data available for this recording.");
          return;
        }
        audioSrc = `data:${stored.mimeType};base64,${stored.audioBase64}`;
        audioCacheRef.current[rec.id] = audioSrc;
      }

      if (!audioSrc) throw new Error("unsupported audio format");

      const audio = new Audio(audioSrc);
      currentAudioRef.current = audio;
      
      audio.onplay = () => {
        setPlayingRecordingId(rec.id!);
        setIsPlaying(true);
      };
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => {
        setPlayingRecordingId(null);
        setIsPlaying(false);
      };
      audio.onerror = () => {
        const err = audio.error;
        let msg = "Playback failed: ";
        if (err?.code === 3) msg += "Decoding failed (unsupported format)";
        else if (err?.code === 4) msg += "Source not supported";
        else msg += "Unknown error";
        
        console.error("Audio error:", err);
        alert(msg);
        stopAllPlayback();
      };
      
      audio.play().catch(e => {
        console.error("Playback start error:", e);
        stopAllPlayback();
      });
    } catch (err: any) {
      console.error("Playback setup error:", err);
      setLoadingAudioId(null);
      stopAllPlayback();
    }
  };

  const submitFeedback = async (recordingId: string) => {
    const feedback = adminFeedback[recordingId] !== undefined 
      ? adminFeedback[recordingId] 
      : (activeStudentRecordings.find(r => r.id === recordingId)?.teacherFeedback || '');
      
    await updateFeedback(recordingId, feedback);
    
    // Update local states for instant visual feedback on status and badges!
    setActiveStudentRecordings(prev => 
      prev.map(r => r.id === recordingId ? { ...r, status: 'reviewed', teacherFeedback: feedback } : r)
    );
    
    setRecordings(prev => 
      prev.map(r => r.id === recordingId ? { ...r, status: 'reviewed', teacherFeedback: feedback } : r)
    );

    // Clean up temporary admin feedback entry
    setAdminFeedback(prev => {
      const copy = { ...prev };
      delete copy[recordingId];
      return copy;
    });

    alert("Feedback sent! Student will be notified.");
  };

  return (
    <div className="min-h-screen bg-page text-ink font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StarMascot className="w-11 h-11 shrink-0" />
            <div>
              <h1 className="text-2xl font-display font-semibold tracking-tight text-ink">Nova English Club</h1>
              <p className="text-xs text-muted">Trinity GESE B1</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user && !isAdmin && (
              <div className="relative group">
                <div className={`p-2 rounded-xl transition-colors ${recordings.some(r => r.status === 'reviewed') ? 'bg-orange-50 text-orange-600 animate-pulse' : 'bg-neutral-100 text-neutral-400'}`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                {recordings.some(r => r.status === 'reviewed') && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                )}
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-neutral-100 p-3 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-[10px] font-bold">
                  {recordings.some(r => r.status === 'reviewed') ? "You have new feedback from your teacher! Scroll down to 'Practice History'." : "No new notifications."}
                </div>
              </div>
            )}
            {user && isAdmin && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                  isEditing ? 'bg-blue-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Settings className="w-4 h-4" />
                {isEditing ? "Exit Setup" : "Customize Content"}
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-2xl border border-line">
                <div className="w-8 h-8 rounded-full bg-blue-soft flex items-center justify-center text-blue font-semibold">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-ink">{user.email}</p>
                  <button onClick={logout} className="text-muted hover:text-ink transition-colors">Sign out</button>
                </div>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue text-white rounded-xl font-semibold hover:bg-blue-ink transition-colors active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                Sign in to practise
              </button>
            )}
          </div>
        </header>

        {isShowingSampleData && (
          <div className="flex items-start gap-3 bg-gold-soft border border-gold/40 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-gold-ink shrink-0 mt-0.5" />
            <p className="text-sm text-gold-ink leading-relaxed">
              <span className="font-semibold">这是内置样例题库，学生看不到。</span>{' '}
              它是一位学员真实准备过的材料（她的女儿、她的猫）。
              在「Customize Content」里给学生导入话题之后，这块就会换成真实内容。
            </p>
          </div>
        )}

        {isEditing ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm min-h-[70vh]">
              <div className="flex border-b border-neutral-100 mb-6 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button 
                  onClick={() => setAdminTab('students')}
                  className={`px-6 py-3 font-bold text-sm shrink-0 flex items-center gap-2 border-b-2 transition-all ${adminTab === 'students' ? 'border-black text-black' : 'border-transparent text-neutral-400'}`}
                >
                  <Users className="w-4 h-4" /> Student Management
                </button>
                <button 
                  onClick={() => setAdminTab('content')}
                  className={`px-6 py-3 font-bold text-sm shrink-0 flex items-center gap-2 border-b-2 transition-all ${adminTab === 'content' ? 'border-black text-black' : 'border-transparent text-neutral-400'}`}
                >
                  <FileText className="w-4 h-4" /> Global Content Library
                </button>
                <button 
                  onClick={() => setAdminTab('listeningSetup')}
                  className={`px-6 py-3 font-bold text-sm shrink-0 flex items-center gap-2 border-b-2 transition-all ${adminTab === 'listeningSetup' ? 'border-black text-black' : 'border-transparent text-neutral-400'}`}
                >
                  <Volume2 className="w-4 h-4" /> Listening Drill Setup
                </button>

                <button 
                  onClick={() => setAdminTab('recovery')}
                  className={`px-6 py-3 font-bold text-sm shrink-0 flex items-center gap-2 border-b-2 transition-all ${adminTab === 'recovery' ? 'border-black text-black' : 'border-transparent text-neutral-400'}`}
                >
                  <RefreshCcw className="w-4 h-4" /> Recovery Mode
                </button>
              </div>

              {adminTab === 'students' ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex gap-2 w-full md:w-auto">
                       <input 
                        type="email"
                        id="new-student-email"
                        placeholder="Add Student Google Email..."
                        className="flex-1 md:w-80 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm"
                       />
                       <button 
                        onClick={async () => {
                          const input = document.getElementById('new-student-email') as HTMLInputElement;
                          if (input.value && input.value.includes('@')) {
                            try {
                              setGenStatus("Adding student...");
                              // The allowlist entry is what admits them. Their profile
                              // is created by the app itself on their first login.
                              await addToAllowlist(input.value.trim().toLowerCase());
                              input.value = "";
                              setGenStatus("Student added successfully!");
                              setTimeout(() => setGenStatus(""), 3000);
                            } catch (e: any) {
                              setGenStatus("Error: " + e.message);
                            }
                          } else {
                            alert("Please enter a valid email address.");
                          }
                        }}
                        className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap active:scale-95 transition-transform"
                       >
                        <Plus className="w-4 h-4" /> Add Student
                       </button>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={bulkGenerateAudio}
                        disabled={isGeneratingAudio}
                        className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-neutral-200 disabled:opacity-50"
                      >
                        <Volume2 className="w-3 h-3" /> 
                        {isGeneratingAudio ? "Generating..." : "Sync Part 1 Audio"}
                      </button>
                      {genStatus && <span className="text-[10px] text-neutral-400 mt-2">{genStatus}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Student List Sidebar */}
                    <div className="lg:col-span-1 border rounded-[2rem] overflow-hidden flex flex-col h-[700px] bg-neutral-50/30">
                      <div className="p-4 bg-neutral-50 border-b space-y-3">
                         <h4 className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Student Directory</h4>
                         <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                           <input 
                            type="text"
                            placeholder="Find student..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-[10px] outline-none focus:border-black transition-colors"
                           />
                         </div>
                      </div>
                      <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {students
                          .filter(s => s.email?.toLowerCase().includes(studentSearch.toLowerCase()))
                          .map(s => {
                            const studentMarkedCount = listeningMarks.filter(m => m.userId === s.uid && m.marked).length;
                            return (
                              <button 
                                key={s.uid}
                                onClick={() => setSelectedStudentId(s.uid!)}
                                className={`w-full p-4 rounded-2xl text-left transition-all flex items-center justify-between group ${selectedStudentId === s.uid ? 'bg-neutral-900 text-white shadow-lg' : 'hover:bg-neutral-50 text-neutral-700'}`}
                              >
                                <div className="flex-1 truncate mr-2">
                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <p className="font-bold text-sm truncate flex-1">{s.email}</p>
                                    {studentMarkedCount > 0 && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold flex items-center gap-0.5 shrink-0 ${
                                        selectedStudentId === s.uid ? 'bg-amber-500/25 text-amber-300' : 'bg-amber-100 text-amber-700 border border-amber-200'
                                      }`}>
                                        ★ {studentMarkedCount}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <p className={`text-[10px] capitalize ${selectedStudentId === s.uid ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                      {s.isInvited ? "Pre-registered" : "Joined"}
                                    </p>
                                    {recordings.some(r => r.studentEmail === s.email && r.status !== 'reviewed') && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${selectedStudentId === s.uid ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                              </button>
                            );
                          })}
                        {students.length === 0 && (
                          <div className="text-center py-10 text-neutral-300 flex flex-col items-center justify-center gap-2">
                             <Mascot size="xs" speechBubble="Invite some students first! 🐾" className="opacity-70" />
                             <p className="text-xs font-bold">No students added yet</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Student Content Editor */}
                    <div className="lg:col-span-3 space-y-6">
                      {!selectedStudentId ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-300 border-2 border-dashed border-neutral-100 rounded-[2rem] py-20">
                          <Mascot size="sm" speechBubble="Select a student to check progress! 🇬🇧" className="mb-2 opacity-80" />
                          <p className="font-bold">Select a student profile to customize content</p>
                        </div>
                      ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                          <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100/50 gap-4">
                            <div>
                               <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-blue-500" />
                                 {students.find(s => s.uid === selectedStudentId)?.email}
                               </h3>
                               <p className="text-[10px] text-blue-700 font-medium uppercase tracking-wider mt-0.5">Customizing Student Content</p>
                            </div>
                            <div className="flex gap-2">
                               <button 
                                onClick={() => {
                                  if (!confirm("Are you sure you want to reset ALL of this student's content by copying from the library template? This will overwrite their custom questions/answers.")) return;
                                  // Bulk clone from global topics
                                  globalTopics.forEach(gt => {
                                    if (gt.section === 'Part 1') {
                                      saveUserTopic({ userId: selectedStudentId, topicName: gt.topicName, questions: gt.questions });
                                    } else {
                                      const answers: Record<string, string> = {};
                                      gt.questions.forEach(q => { answers[q.id] = q.suggestedAnswer; });
                                      savePersonalizedConversation({ userId: selectedStudentId, topicName: gt.topicName, answers });
                                    }
                                  });
                                  alert("Applied from Library Template!");
                                }}
                                className="px-5 py-2 bg-black text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-neutral-800 transition-all active:scale-95"
                               >
                                 <RefreshCcw className="w-3 h-3" /> Apply Library Defaults
                               </button>
                               <button 
                                onClick={() => {
                                  const source = prompt("Clone from which existing student's email?");
                                  if (source) {
                                    const src = allUsers.find(u => u.email === source);
                                    if (src) cloneStudentData(src.uid!, selectedStudentId);
                                    else alert("User not found among registered students.");
                                  }
                                }}
                                className="px-5 py-2 bg-white text-neutral-600 rounded-xl text-xs font-bold border border-neutral-200 flex items-center gap-2 hover:bg-neutral-100 transition-colors shadow-sm"
                               >
                                 <Copy className="w-3 h-3" /> Copy from Student
                               </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Part 1: Full customization */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h4 className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Part 1 Editor</h4>
                                <div className="flex gap-2">
                                  <button onClick={() => {
                                    setImportType('part1');
                                    setShowImportModal(true);
                                  }} className="text-[10px] font-bold text-blue-600 hover:underline">Import JSON</button>
                                </div>
                              </div>
                              {/*
                                Part 1 topics are whatever this student chose with
                                their teacher, so the list is theirs and editable.
                                It used to be a fixed five taken from a constant,
                                which meant a second student could not be given
                                their own topics at all.
                              */}
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <select
                                    value={studentPart1Topics.includes(selectedTopic) ? selectedTopic : ""}
                                    onChange={(e) => setSelectedTopic(e.target.value)}
                                    className="flex-1 p-4 bg-white border border-neutral-200 rounded-2xl font-bold text-sm shadow-sm"
                                  >
                                    <option value="">
                                      {studentPart1Topics.length ? "选择话题…" : "还没有话题，先在下面加一个"}
                                    </option>
                                    {studentPart1Topics.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  {selectedTopic && studentPart1Topics.includes(selectedTopic) && (
                                    <button
                                      onClick={async () => {
                                        if (!selectedStudentId) return;
                                        if (!confirm(`删除话题「${selectedTopic}」及其所有题目？`)) return;
                                        await deleteUserTopic(selectedStudentId, selectedTopic);
                                        setSelectedTopic("");
                                      }}
                                      className="px-4 rounded-2xl border border-neutral-200 bg-white text-neutral-400 hover:text-red-600 hover:border-red-200 transition-colors"
                                      title="删除这个话题"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  <input
                                    value={newTopicName}
                                    onChange={(e) => setNewTopicName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') addPart1Topic(); }}
                                    placeholder="新话题名，例如 My job"
                                    className="flex-1 p-3 bg-white border border-neutral-200 rounded-xl text-sm"
                                  />
                                  <button
                                    onClick={addPart1Topic}
                                    disabled={!newTopicName.trim() || !selectedStudentId}
                                    className="px-4 py-3 bg-neutral-950 text-white rounded-xl text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> 加话题
                                  </button>
                                </div>

                                {addableLibraryTopics.length > 0 && (
                                  <div className="pt-1">
                                    <p className="text-[10px] font-bold text-neutral-400 mb-1.5">
                                      从模板库添加（题目和参考答案一起带过来，之后照这个学生改）
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {addableLibraryTopics.map(gt => (
                                        <button
                                          key={gt.topicName}
                                          onClick={() => addTopicFromLibrary(gt)}
                                          className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-[11px] font-bold text-neutral-600 hover:border-neutral-950 hover:text-neutral-950 transition-colors flex items-center gap-1"
                                        >
                                          <Plus className="w-3 h-3" />
                                          {gt.topicName}
                                          <span className="text-neutral-400 font-medium">{gt.questions.length}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {selectedTopic && studentPart1Topics.includes(selectedTopic) && (
                                <button
                                  onClick={addPart1Question}
                                  className="w-full py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs font-bold text-neutral-500 hover:border-neutral-950 hover:text-neutral-950 transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" /> 给「{selectedTopic}」加一题
                                </button>
                              )}

                              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                {filteredQuestions.map((q, idx) => (
                                  <div key={q.id} className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-neutral-400">{idx + 1}</span>
                                        <input 
                                          value={q.question}
                                          onChange={(e) => {
                                            const newQs = [...filteredQuestions];
                                            newQs[idx].question = e.target.value;
                                            saveUserTopic({
                                              userId: selectedStudentId,
                                              topicName: selectedTopic,
                                              questions: newQs.map(nq => ({ id: nq.id, question: nq.question, suggestedAnswer: nq.suggestedAnswer }))
                                            });
                                          }}
                                          className="flex-1 p-2 text-xs font-bold border border-neutral-200 rounded-lg outline-none focus:border-black"
                                          placeholder="Question text..."
                                        />
                                        <button 
                                          onClick={() => generateSingleAudio(q.id, q.question)}
                                          disabled={isGeneratingItem === q.id}
                                          className={`p-2 rounded-lg transition-all ${isGeneratingItem === q.id ? 'bg-neutral-100 text-neutral-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                          title="Generate AI Voice"
                                        >
                                          {isGeneratingItem === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                    <textarea 
                                      value={q.suggestedAnswer}
                                      onChange={(e) => {
                                        const newQs = [...filteredQuestions];
                                        newQs[idx].suggestedAnswer = e.target.value;
                                        saveUserTopic({
                                          userId: selectedStudentId,
                                          topicName: selectedTopic,
                                          questions: newQs.map(nq => ({ id: nq.id, question: nq.question, suggestedAnswer: nq.suggestedAnswer }))
                                        });
                                      }}
                                      className="w-full p-3 text-xs border border-neutral-200 rounded-lg bg-white h-24 italic leading-relaxed"
                                      placeholder="Personalized Suggested Answer..."
                                    />
                                  </div>
                                ))}
                                {filteredQuestions.length === 0 && (
                                  <button 
                                    onClick={() => {
                                      const template = globalTopics.find(gt => gt.topicName === selectedTopic);
                                      if (template) saveUserTopic({ userId: selectedStudentId, topicName: selectedTopic, questions: template.questions });
                                      else alert("No template found for this topic. Add it in Content Library first.");
                                    }}
                                    className="w-full py-10 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400 font-bold text-sm hover:border-neutral-400 hover:text-neutral-600 transition-all"
                                  >
                                    + Apply Topic Template
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Part 2: Answers Only */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h4 className="text-[11px] font-black uppercase text-neutral-400 tracking-wider">Part 2 Personalization</h4>
                                <button onClick={() => {
                                  setImportType('part2');
                                  setShowImportModal(true);
                                }} className="text-[10px] font-bold text-blue-600 hover:underline">Import JSON</button>
                              </div>
                              <div className="space-y-4 max-h-[570px] overflow-y-auto pr-2 scrollbar-thin">
                                {TRINITY_B1_TOPICS.slice(5).map(topic => (
                                  <div key={topic} className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100">
                                    <div className="flex items-center justify-between mb-4 border-b border-neutral-200 pb-2">
                                      <p className="text-[10px] font-bold text-neutral-400">{topic}</p>
                                      <button
                                        onClick={() => addPart2Question(topic)}
                                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                        title="题目会加进共享库，所有学生都看得到；答案各人各写"
                                      >
                                        <Plus className="w-3 h-3" /> 加一题
                                      </button>
                                    </div>
                                    <div className="space-y-4">
                                      {displayQuestions.filter(q => q.topic === topic).map(q => (
                                        <div key={q.id} className="space-y-2 pb-4 border-b border-neutral-100 last:border-0 last:pb-0">
                                           <div className="flex flex-col gap-1">
                                              <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black uppercase text-neutral-400">Question Text</label>
                                                <button 
                                                  onClick={() => generateSingleAudio(q.id, q.question)}
                                                  disabled={isGeneratingItem === q.id}
                                                  className={`p-1.5 rounded-lg transition-all ${isGeneratingItem === q.id ? 'bg-neutral-100 text-neutral-400' : 'text-blue-600 hover:bg-blue-50'}`}
                                                  title="Generate AI Voice"
                                                >
                                                  {isGeneratingItem === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                                </button>
                                              </div>
                                              <input 
                                                value={q.question}
                                                onChange={(e) => {
                                                  const currentConv = userConvs.find(c => c.topicName === topic) || { userId: selectedStudentId!, topicName: topic, answers: {}, questions: {} };
                                                  const updatedQuestions = { ...(currentConv.questions || {}), [q.id]: e.target.value };
                                                  savePersonalizedConversation({ ...currentConv, questions: updatedQuestions });
                                                }}
                                                className="w-full p-2 text-[11px] font-bold border border-neutral-200 rounded-lg bg-white focus:border-black outline-none"
                                              />
                                           </div>
                                           <div className="flex flex-col gap-1">
                                              <label className="text-[9px] font-black uppercase text-neutral-400">Student Answer</label>
                                              <input 
                                                value={q.suggestedAnswer}
                                                onChange={(e) => {
                                                  const currentConv = userConvs.find(c => c.topicName === topic) || { userId: selectedStudentId!, topicName: topic, answers: {}, questions: {} };
                                                  const updatedAnswers = { ...currentConv.answers, [q.id]: e.target.value };
                                                  savePersonalizedConversation({ ...currentConv, answers: updatedAnswers });
                                                }}
                                                className="w-full p-2 text-[11px] border border-neutral-200 rounded-lg bg-white focus:border-black outline-none"
                                                placeholder="Default answer will be used if empty..."
                                              />
                                           </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Listening Needs Practice Statistics and Difficult Questions list */}
                          {(() => {
                            const studentMarks = listeningMarks.filter(m => m.userId === selectedStudentId && m.marked);
                            return (
                              <div className="p-8 bg-amber-50/50 rounded-[2rem] border border-amber-200/50 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-amber-500 font-extrabold text-base">★</span>
                                    <h4 className="text-sm font-black uppercase text-amber-950 tracking-wider">
                                      Listening Difficult Questions ({studentMarks.length})
                                    </h4>
                                  </div>
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
                                    Need Practice List / 学员难点标记
                                  </span>
                                </div>

                                {studentMarks.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {studentMarks.map((m) => {
                                      const qInfo = getQuestionTextById(m.questionId);
                                      return (
                                        <div key={m.id} className="bg-white p-5 rounded-2xl border border-amber-150 shadow-sm space-y-2 hover:shadow-md transition-shadow relative">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                              {qInfo.type}
                                            </span>
                                            <span className="text-[9px] font-mono font-bold text-neutral-400">
                                              ID: {m.questionId}
                                            </span>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold text-neutral-800 font-sans leading-relaxed">
                                              {m.topic && <span className="text-blue-600 font-bold mr-1">[{m.topic}]</span>}
                                              {qInfo.text}
                                            </p>
                                            {qInfo.chinese && (
                                              <p className="text-xs text-neutral-400 font-medium">
                                                {qInfo.chinese}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-6 bg-white/40 border border-amber-100/30 rounded-2xl gap-2">
                                    <Mascot size="xs" speechBubble="A clear record! Splendid! 🎉" className="opacity-80" />
                                    <p className="text-xs text-amber-800/60 italic text-center">
                                      This student hasn't flagged any listening questions yet / 目前该学员尚无难点标记。
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : adminTab === 'content' ? (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-neutral-900 text-white rounded-[2.5rem]">
                     <div>
                        <h3 className="text-xl font-bold font-display">模板库</h3>
                        <p className="text-neutral-400 text-sm mt-1">
                          配新学生时从这里挑话题。Part 1 的模板会出现在学生编辑器的「从模板库添加」里；
                          Part 2 是所有人共用的题目，答案各人各写。
                        </p>
                     </div>
                     <button
                      onClick={() => {
                        if (!confirm(
                          "把内置的 120 道样例题灌进模板库（自动分好 Part 1 / Part 2）。\n\n" +
                          "同名话题会被覆盖。灌进来之后，配新学生时就能从模板库挑话题了。\n\n继续？"
                        )) return;
                        const topics = Array.from(new Set(B1_QUESTIONS.map(q => q.topic)));
                        topics.forEach(t => {
                          const qs = B1_QUESTIONS.filter(q => q.topic === t).map(q => ({
                            id: q.id,
                            question: q.question,
                            suggestedAnswer: q.suggestedAnswer
                          }));
                          saveGlobalTopic({ topicName: t, section: TRINITY_B1_TOPICS.indexOf(t) < 5 ? 'Part 1' : 'Part 2', questions: qs });
                        });
                        alert("模板库已就绪。现在去 Student Management，选中学生就能从模板库挑话题了。");
                      }}
                      className="px-6 py-3 bg-white text-black font-bold rounded-xl text-sm hover:bg-neutral-100 transition-all flex items-center gap-2"
                     >
                       <RefreshCcw className="w-4 h-4" /> 用内置样例填充模板库
                     </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
                    {globalTopics.map((gt, tIdx) => (
                      <div key={gt.id} className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-neutral-900">{gt.topicName}</h4>
                            <span className="text-[10px] font-black uppercase text-neutral-400">{gt.section}</span>
                          </div>
                          <button 
                            onClick={() => {
                              if (confirm(`Delete topic "${gt.topicName}" and all its template questions?`)) {
                                deleteGlobalTopic(gt.id!);
                              }
                            }}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex-1 p-6 space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin">
                          {gt.questions.map((q, idx) => (
                            <div key={q.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2 shadow-sm relative group/row">
                              <button 
                                onClick={() => {
                                  const newQs = gt.questions.filter((_, i) => i !== idx);
                                  saveGlobalTopic({ ...gt, questions: newQs });
                                }}
                                className="absolute -top-2 -right-2 bg-white text-red-500 p-1.5 rounded-full shadow-md border border-red-50 opacity-0 group-hover/row:opacity-100 transition-opacity z-10 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <div className="flex gap-2">
                                <span className="text-[10px] font-bold text-neutral-300 mt-1">{idx + 1}</span>
                                <input 
                                  value={q.question}
                                  onChange={(e) => {
                                    const newQs = [...gt.questions];
                                    newQs[idx].question = e.target.value;
                                    saveGlobalTopic({ ...gt, questions: newQs });
                                  }}
                                  className="flex-1 bg-transparent border-none text-xs font-bold outline-none placeholder:text-neutral-300"
                                  placeholder="Common Question..."
                                />
                                <button 
                                  onClick={() => generateSingleAudio(q.id, q.question)}
                                  disabled={isGeneratingItem === q.id}
                                  className={`p-1.5 rounded-lg transition-all ${isGeneratingItem === q.id ? 'bg-neutral-100 text-neutral-400' : 'text-blue-600 hover:bg-blue-50'}`}
                                  title="Generate AI Voice"
                                >
                                  {isGeneratingItem === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                </button>
                              </div>
                              <textarea 
                                value={q.suggestedAnswer}
                                onChange={(e) => {
                                  const newQs = [...gt.questions];
                                  newQs[idx].suggestedAnswer = e.target.value;
                                  saveGlobalTopic({ ...gt, questions: newQs });
                                }}
                                className="w-full text-neutral-500 outline-none text-[11px] h-14 bg-white border border-neutral-100 rounded-lg p-2 resize-none"
                                placeholder="Public Default Answer..."
                              />
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newId = `${gt.topicName.charAt(0).toLowerCase()}${Date.now()}`;
                              const newQs = [...gt.questions, { id: newId, question: "", suggestedAnswer: "" }];
                              saveGlobalTopic({ ...gt, questions: newQs });
                            }}
                            className="w-full py-3 border border-dashed border-neutral-300 rounded-xl text-[10px] font-bold text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50 transition-all uppercase tracking-widest"
                          >
                            + Add Question row
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const name = prompt("Enter new topic name:");
                        if (name) {
                          const section = confirm("Is this Part 1? (Ok = Part 1, Cancel = Part 2)") ? 'Part 1' : 'Part 2';
                          saveGlobalTopic({ topicName: name, section, questions: [] });
                        }
                      }}
                      className="border-4 border-dashed border-neutral-100 rounded-[2rem] flex flex-col items-center justify-center py-20 text-neutral-200 hover:text-neutral-400 hover:border-neutral-200 transition-all"
                    >
                      <Plus className="w-12 h-12 mb-2" />
                      <span className="font-bold uppercase tracking-widest text-xs">Create New Topic</span>
                    </button>
                  </div>
                </div>
              ) : adminTab === 'recovery' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white border border-neutral-100 rounded-2xl shadow-sm">
                      <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Audit Progress</p>
                      <p className="text-2xl font-black mt-1">{recordings.length} <span className="text-xs font-normal text-neutral-400">Total Scanned</span></p>
                    </div>
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl shadow-sm">
                      <p className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Firestore Bloat</p>
                      <p className="text-2xl font-black mt-1 text-orange-600">{recordings.filter(r => !!r.audioBase64).length} <span className="text-xs font-normal text-orange-400">Items with Base64</span></p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Estimated Waste</p>
                      <p className="text-2xl font-black mt-1 text-blue-600">
                        {(recordings.reduce((acc, curr) => acc + (curr.audioBase64?.length || 0), 0) / 1024 / 1024).toFixed(2)} 
                        <span className="text-xs font-normal text-blue-400"> MB in UI</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-blue-500 w-5 h-5 shrink-0" />
                      <p className="text-xs text-blue-800 leading-relaxed font-medium">
                        <span className="font-bold">Cleanup Policy:</span> You can safely remove Base64 data if a Storage URL exists. This reduces Firestore costs.
                      </p>
                    </div>
                    <button 
                      onClick={async () => {
                        const targets = recordings.filter(r => r.audioBase64 && r.audioUrl);
                        if (targets.length === 0) return alert("No items to clean up in current view.");
                        if (!confirm(`Clean up ${targets.length} items? This only removes the Firestore bloat, keeping the recording file.`)) return;
                        
                        setIsLoadingMore(true);
                        for (const t of targets) {
                          if (t.id) await deleteAudioBase64(t.id);
                        }
                        setIsLoadingMore(false);
                        alert("Cleanup complete!");
                      }}
                      disabled={isLoadingMore}
                      className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:bg-neutral-300"
                    >
                      Clean Current View
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-neutral-100 rounded-2xl bg-white shadow-sm font-sans">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 text-neutral-400 font-black uppercase tracking-widest border-b border-neutral-100">
                          <th className="p-4 border-r border-neutral-100">Student / Question</th>
                          <th className="p-4 border-r border-neutral-100 text-center">Cloud Storage</th>
                          <th className="p-4 border-r border-neutral-100 text-center">Firestore Data</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {recordings.map(rec => (
                          <tr key={rec.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="p-4 border-r border-neutral-100">
                              <p className="font-bold text-neutral-900">{rec.studentEmail}</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{rec.questionText}</p>
                            </td>
                            <td className="p-4 border-r border-neutral-100 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${rec.audioUrl ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {rec.audioUrl ? 'Linked' : 'Missing'}
                                </div>
                                {rec.audioUrl && <span className="text-[8px] text-neutral-400 font-mono">Storage Linked</span>}
                              </div>
                            </td>
                            <td className="p-4 border-r border-neutral-100 text-center">
                               {rec.audioBase64 ? (
                                 <div className="space-y-1">
                                   <div className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-[9px] font-black uppercase tracking-tighter inline-block">
                                      {Math.round((rec.audioBase64.length * 0.75) / 1024)} KB Payload
                                   </div>
                                   <p className="text-[8px] text-neutral-400 font-mono">{rec.audioBase64.length} chars</p>
                                 </div>
                               ) : (
                                 <div className="px-2 py-1 bg-neutral-100 text-neutral-400 rounded-full text-[9px] font-black uppercase tracking-tighter inline-block">
                                    Clean
                                 </div>
                               )}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => playRecording(rec)}
                                    className={`p-2 rounded-lg transition-all ${playingRecordingId === rec.id && isPlaying ? 'bg-blue-600 text-white shadow-lg' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                                  >
                                    {playingRecordingId === rec.id && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                  </button>
                                  {rec.audioUrl && (
                                    <button 
                                      onClick={async () => {
                                        if (rec.id && confirm("Delete the Base64 field from this document? The Storage file will remain.")) {
                                          await deleteAudioBase64(rec.id);
                                        }
                                      }}
                                      className="p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                                      title="Delete Base64 Bloat"
                                      disabled={!rec.audioBase64 && !rec.hasAudio}
                                    >
                                      <Trash2 className="w-4 h-4 outline-none" />
                                    </button>
                                  )}
                                  {rec.audioUrl && (
                                    <a href={rec.audioUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200">
                                      <Download className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasMoreRecordings && (
                    <button onClick={loadMoreRecordings} className="w-full py-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-[10px] font-black uppercase text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all flex items-center justify-center gap-2">
                      <RefreshCcw className={`w-3 h-3 ${isLoadingMore ? 'animate-spin' : ''}`} />
                      {isLoadingMore ? "Loading..." : "Load More for Audit"}
                    </button>
                  )}
                </div>
              ) : adminTab === 'listeningSetup' ? (
                <ListeningSetupPanel
                  displayQuestions={getDisplayQuestions()}
                  listeningMetadata={listeningMetadata}
                  saveListeningMetadata={saveListeningMetadata}
                />
              ) : null}
            </div>
          </motion.div>
        ) : activeDeck ? (
          <PracticeDeck
            deckName={activeDeck}
            deckColor={deckColour(activeDeck)}
            questions={deckQuestions}
            cardState={deckCardState}
            onToggleMark={toggleMark}
            onSpeak={(q) => speakQuestion(q.question, q.audioUrl)}
            onExit={() => { setActiveDeck(null); recordingQuestionRef.current = null; }}
            isRecording={isRecording}
            recordingTime={recordingTime}
            isSaving={isSaving}
            onStartRecording={startRecordingFor}
            onStopRecording={stopRecording}
            canSubmit={isEnrolled}
          />
        ) : !activeModule ? (
          <div className="space-y-12 animate-in fade-in duration-500 py-6 select-none leading-normal">
            <div className="text-center space-y-4 max-w-xl mx-auto flex flex-col items-center">
              <Mascot
                size="md"
                speechBubble="慢慢来，说错了也没关系。"
                className="mb-2"
              />
              <h2 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-ink">
                What do you want to practise?
              </h2>
              <p className="text-sm text-ink-soft leading-relaxed">
                Listening trains your ear for the examiner's questions.
                Speaking is where you record an answer and send it to your teacher.
              </p>
            </div>

            {/* Part 1 decks: the topics this student chose with their teacher. */}
            {part1Decks.length > 0 && (
              <div className="max-w-4xl mx-auto w-full">
                <div className="flex items-baseline gap-3 mb-1">
                  <h3 className="font-display text-lg font-semibold">Part 1</h3>
                  <span className="text-xs font-medium text-gold-ink bg-gold-soft px-2 py-0.5 rounded-md">你自己选的</span>
                  <span className="ml-auto text-xs text-muted">{part1Decks.length} 副牌</span>
                </div>
                <p className="text-sm text-ink-soft mb-4">考官只会问你准备过的生活。</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {part1Decks.map(d => (
                    <button
                      key={d.topic}
                      onClick={() => setActiveDeck(d.topic)}
                      className="text-left rounded-2xl p-4 h-28 flex flex-col justify-between text-white transition-transform hover:-translate-y-0.5"
                      style={{ background: deckColour(d.topic) }}
                    >
                      <span className="font-semibold text-sm leading-tight">{d.topic}</span>
                      <span className="text-[11px] opacity-85">
                        {d.total} 张{d.fresh > 0 ? ` · 没练过 ${d.fresh}` : ' · 全练过了'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-4">
              {/* CARD 1: Train Listening */}
              <button 
                id="portal-btn-listening"
                onClick={() => setActiveModule('listening')}
                className="group text-left bg-card rounded-[2rem] border border-line hover:border-ink transition-colors duration-200 p-8 md:p-10 flex flex-col justify-between min-h-[22rem]"
              >
                <div className="space-y-6">
                  <div className="w-14 h-14 bg-sand text-ink rounded-2xl flex items-center justify-center group-hover:bg-ink group-hover:text-page transition-colors duration-200">
                    <Headphones className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-display font-semibold text-ink flex items-center gap-2.5">
                      Listening
                      <span className="text-xs font-sans font-medium text-muted">听力训练</span>
                    </h3>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      The question stays hidden while you listen. You catch the keywords
                      by ear first, then check yourself against the text.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-5 mt-8 w-full text-sm">
                  <span className="font-semibold text-ink inline-flex items-center gap-1.5">
                    Start listening
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <div className="flex gap-2 text-xs text-ink-soft">
                    <span className="px-2.5 py-1 bg-sand rounded-lg">Slower playback</span>
                    <span className="px-2.5 py-1 bg-sand rounded-lg">4 steps</span>
                  </div>
                </div>
              </button>

              {/* CARD 2: Practice Speaking */}
              <button 
                id="portal-btn-speaking"
                onClick={() => setActiveModule('speaking')}
                className="group text-left bg-card rounded-[2rem] border border-line hover:border-blue transition-colors duration-200 p-8 md:p-10 flex flex-col justify-between min-h-[22rem]"
              >
                <div className="space-y-6">
                  <div className="w-14 h-14 bg-blue-soft text-blue rounded-2xl flex items-center justify-center group-hover:bg-blue group-hover:text-white transition-colors duration-200">
                    <Mic className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-display font-semibold text-ink flex items-center gap-2.5">
                      Speaking
                      <span className="text-xs font-sans font-medium text-muted">口语实战</span>
                    </h3>
                    <p className="text-sm text-ink-soft leading-relaxed">
                      Record a full answer to a topic question. It goes straight to your
                      teacher, who listens and writes back.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-5 mt-8 w-full text-sm">
                  <span className="font-semibold text-blue inline-flex items-center gap-1.5">
                    Start speaking
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <div className="flex gap-2 text-xs text-ink-soft">
                    <span className="px-2.5 py-1 bg-sand rounded-lg">Record</span>
                    <span className="px-2.5 py-1 bg-sand rounded-lg">Teacher replies</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : activeModule === 'listening' ? (
          <ListeningDrill
            user={user}
            selectedTopic={selectedTopic}
            setSelectedTopic={setSelectedTopic}
            displayQuestions={listeningDrillQuestions}
            listeningMetadata={listeningMetadata}
            listeningMarks={listeningMarks}
            isAdmin={isAdmin}
            onBackToLobby={() => setActiveModule(null)}
            onJumpToSpeaking={(qId, topic) => {
              setSelectedTopic(topic);
              const targetQ = getDisplayQuestions().find(q => q.id === qId);
              if (targetQ) {
                setCurrentQuestion(targetQ);
              }
              setActiveModule('speaking');
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex justify-start">
              <button 
                onClick={() => { setActiveModule(null); setCurrentQuestion(null); }}
                className="px-4 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-800 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 transition-all shrink-0"
              >
                ← Exit to Practice Lobby
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Topics & Questions */}
          <div className={`${currentQuestion ? 'hidden lg:block' : 'block'} lg:col-span-4 space-y-6`}>
            <section className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <BookOpen className="w-3 h-3" />
                Study Topics
              </h2>
              
              <div className="space-y-6">
                {/* Part 1: Topic */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-4 h-4 rounded bg-neutral-900 flex items-center justify-center text-[10px] text-white font-bold">1</div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Exam Part 1: Your Topic</label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {part1Topics.map(topic => (
                      <button
                        key={topic}
                        onClick={() => { setSelectedTopic(topic); setCurrentQuestion(null); }}
                        className={`text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
                          selectedTopic === topic 
                            ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm' 
                            : 'bg-white text-neutral-600 border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Part 2: Conversation */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-4 h-4 rounded bg-neutral-400 flex items-center justify-center text-[10px] text-white font-bold">2</div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Exam Part 2: Conversation</label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {part2Topics.map(topic => (
                      <button
                        key={topic}
                        onClick={() => { setSelectedTopic(topic); setCurrentQuestion(null); }}
                        className={`text-left px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
                          selectedTopic === topic 
                            ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm' 
                            : 'bg-white text-neutral-600 border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">Questions</h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {filteredQuestions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestion(q)}
                    className={`w-full text-left px-3 py-3 rounded-xl border text-sm transition-all flex gap-3 ${
                      currentQuestion?.id === q.id ? 'border-neutral-950 bg-white ring-2 ring-neutral-950 shadow-sm' : 'border-neutral-200 bg-white hover:border-neutral-400'
                    }`}
                  >
                    <span className="font-mono text-neutral-400 shrink-0">{idx + 1}.</span>
                    <span className="leading-tight font-medium line-clamp-2 text-neutral-700">{q.question}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* MIDDLE: Active Practice */}
          <div className={`${currentQuestion ? 'block' : 'hidden lg:block'} lg:col-span-8 space-y-8`}>
            {currentQuestion ? (
              <div className="space-y-4">
                <div className="lg:hidden">
                  <button 
                    onClick={() => setCurrentQuestion(null)}
                    className="w-full py-3.5 px-4 bg-neutral-900 text-white hover:bg-neutral-800 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                  >
                    ← Back to Questions (返回问题列表)
                  </button>
                </div>
                <motion.div layout className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-neutral-200 shadow-sm p-6 md:p-12 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between font-sans">
                      <span className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase border border-blue-100">
                        {currentTopic()}
                      </span>
                      <button 
                        onClick={playQuestion}
                        className={`flex items-center justify-center w-14 h-14 rounded-2xl transition-all shadow-md ${
                          isSpeaking ? 'bg-blue-100 text-blue-500 animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                        }`}
                      >
                        <Volume2 className="w-8 h-8" />
                      </button>
                    </div>
                    <h3 className="text-xl md:text-3xl font-bold leading-tight text-neutral-950 font-display leading-snug">
                      <span className="text-neutral-300 font-mono mr-2">{filteredQuestions.findIndex(q => q.id === currentQuestion.id) + 1}.</span>
                      {currentQuestion.question}
                    </h3>
                    
                    <div className="space-y-4 pt-2">
                      <button
                        onClick={() => setShowAnswer(prev => !prev)}
                        className={`w-full py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all gap-2 flex items-center justify-center border shadow-sm ${
                          showAnswer
                            ? 'bg-neutral-150 text-neutral-700 border-neutral-300'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200/50'
                        }`}
                      >
                        {showAnswer ? "Hide Answer (隐藏参考答案)" : "Show Answer (显示参考答案)"}
                      </button>

                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-neutral-50 rounded-2xl md:rounded-3xl p-6 border border-neutral-150 font-sans text-left mt-2 space-y-3">
                              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 bg-blue-500 h-2 rounded-full animate-pulse" />
                                Suggested Oral response • 听音口语参考
                              </h4>
                              <p className="text-sm md:text-base text-neutral-800 leading-relaxed italic pr-4">
                                "{currentQuestion.suggestedAnswer}"
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-8 border-t border-neutral-100 pt-10">
                    <motion.button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`relative flex items-center justify-center w-32 h-32 rounded-full transition-all active:scale-95 shadow-2xl ${
                        isRecording ? 'bg-red-500 ring-8 ring-red-100 animate-pulse' : 'bg-neutral-950 ring-8 ring-neutral-50 hover:bg-neutral-800'
                      }`}
                    >
                      {isRecording ? <Square className="w-12 h-12 text-white fill-current" /> : <Mic className="w-14 h-14 text-white" />}
                      {isRecording && (
                        <div className="absolute -bottom-16">
                          <span className="text-red-500 font-mono text-xl font-black bg-red-50 px-4 py-1 rounded-full border border-red-100">
                            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      )}
                    </motion.button>
                    <p className="text-neutral-900 font-bold text-lg font-display">
                      {isRecording ? "Recording your voice..." : "Click to Practice"}
                    </p>
                    {!isRecording && (
                      <p className="text-[10px] text-neutral-400 font-medium">
                        Tip: Wear headphones for the best recording quality.
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-neutral-400 border-4 border-dashed border-neutral-200 rounded-[3rem] bg-neutral-50/50">
                <Play className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold font-display">Select a question to start</p>
              </div>
            )}

            {/* LIST: History / Feedback */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-950 flex items-center gap-2 font-display">
                  {isAdmin ? "Student Recordings" : "Your Practice History"}
                  <span className="text-xs font-medium px-2 py-0.5 bg-neutral-200 rounded-lg">
                    {recordings.length} total
                  </span>
                </h2>
                
                <div className="flex flex-wrap items-center gap-3">
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        window.location.reload();
                      }}
                      className="p-2 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all text-neutral-400 group cursor-pointer animate-none"
                      title="Force Refresh Data"
                    >
                      <RefreshCcw className="w-4 h-4 group-active:rotate-180 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-6">
                {recordings.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100 italic text-neutral-400 flex flex-col items-center gap-3">
                    <Mascot size="xs" speechBubble="Awaiting your first practice recording! 🎧" className="opacity-75" />
                    <p className="font-bold">No recordings found in the database.</p>
                  </div>
                )}

                {isAdmin ?
                  (() => {
                    const getLastSubmittedTextLocal = (recs: Recording[]) => {
                      if (recs.length === 0) return "";
                      const times = recs.map(r => {
                        if (!r.createdAt) return 0;
                        if (typeof r.createdAt.toMillis === 'function') return r.createdAt.toMillis();
                        if (r.createdAt instanceof Date) return r.createdAt.getTime();
                        if (typeof r.createdAt === 'number') return r.createdAt;
                        if (typeof r.createdAt === 'object' && r.createdAt.seconds) return r.createdAt.seconds * 1000;
                        return 0;
                      }).filter(t => t > 0);
                      
                      if (times.length === 0) return "";
                      const maxTime = Math.max(...times);
                      const diffMs = Date.now() - maxTime;
                      const diffMins = Math.round(diffMs / 60000);
                      if (diffMins < 1) return "Just now";
                      if (diffMins < 60) return `${diffMins}m`;
                      const diffHours = Math.round(diffMins / 60);
                      if (diffHours < 24) return `${diffHours}h`;
                      const diffDays = Math.round(diffHours / 24);
                      return `${diffDays}d`;
                    };

                    const recsGroups: Record<string, Recording[]> = {};
                    recordings.forEach(rec => {
                      const email = rec.studentEmail?.trim().toLowerCase();
                      if (email) {
                        if (!recsGroups[email]) recsGroups[email] = [];
                        recsGroups[email].push(rec);
                      }
                    });

                    const allStudentEmails = new Set<string>();
                    const studentProfilesByEmail: Record<string, UserProfile> = {};

                    students.forEach(s => {
                      if (s.email) {
                        const emailClean = s.email.trim().toLowerCase();
                        allStudentEmails.add(emailClean);
                        studentProfilesByEmail[emailClean] = s;
                      }
                    });

                    Object.keys(recsGroups).forEach(email => {
                      allStudentEmails.add(email);
                    });

                    const list = Array.from(allStudentEmails).map(email => {
                      const profile = studentProfilesByEmail[email];
                      const userRecs = recsGroups[email] || [];
                      const isActive = selectedRecordingsStudentEmail === email;
                      const finalRecs = (isActive && activeStudentRecordings.length > 0) ? activeStudentRecordings : userRecs;

                      const pendingCount = finalRecs.filter(r => r.status !== 'reviewed').length;
                      const reviewedCount = finalRecs.filter(r => r.status === 'reviewed').length;
                      const totalCount = finalRecs.length;
                      const lastSubmittedText = getLastSubmittedTextLocal(finalRecs);

                      return {
                        email,
                        displayName: profile?.displayName || "",
                        pendingCount,
                        reviewedCount,
                        totalCount,
                        lastSubmittedText,
                        lastTimestamp: Math.max(...finalRecs.map(r => {
                          if (!r.createdAt) return 0;
                          if (typeof r.createdAt.toMillis === 'function') return r.createdAt.toMillis();
                          if (r.createdAt instanceof Date) return r.createdAt.getTime();
                          if (typeof r.createdAt === 'number') return r.createdAt;
                          if (typeof r.createdAt === 'object' && r.createdAt.seconds) return r.createdAt.seconds * 1000;
                          return 0;
                        }))
                      };
                    });

                    const filteredList = list.filter(item => 
                      item.email.includes(recordingStudentSearch.trim().toLowerCase())
                    );

                    filteredList.sort((a, b) => {
                      if (a.pendingCount !== b.pendingCount) {
                        return b.pendingCount - a.pendingCount;
                      }
                      return b.lastTimestamp - a.lastTimestamp;
                    });

                    const compiledStudentRecs = activeStudentRecordings.filter(r => {
                      if (statusFilter === 'all') return true;
                      if (statusFilter === 'pending') return r.status !== 'reviewed';
                      if (statusFilter === 'reviewed') return r.status === 'reviewed';
                      return true;
                    });

                    const selectedStudentDisplayName = selectedRecordingsStudentEmail
                      ? (studentProfilesByEmail[selectedRecordingsStudentEmail]?.displayName || "")
                      : "";

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* LEFT COLUMN: Student Lists Sidebar (Col span 4) */}
                        <div className="lg:col-span-4 bg-white rounded-3xl border border-neutral-200/85 p-6 space-y-4">
                          <div className="space-y-1">
                            <h3 className="text-sm font-black uppercase text-neutral-400 tracking-wider">Student Directory</h3>
                            <p className="text-[11px] text-neutral-500">Pick a student to view records & submit reviews.</p>
                          </div>
                          
                          <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input 
                              type="text"
                              placeholder="Search student email..."
                              value={recordingStudentSearch}
                              onChange={(e) => setRecordingStudentSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-black focus:bg-white transition-all shadow-sm placeholder:text-neutral-400 text-neutral-800"
                            />
                          </div>
                          
                          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                            <button
                              onClick={() => {
                                setSelectedRecordingsStudentEmail(null);
                                setActiveStudentRecordings([]);
                              }}
                              className={`w-full p-4 rounded-2xl text-left transition-all flex items-center justify-between border cursor-pointer ${
                                selectedRecordingsStudentEmail === null 
                                  ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm scale-[1.01]' 
                                  : 'bg-neutral-50/50 hover:bg-neutral-50 border-neutral-100/60'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                                  📊
                                </div>
                                <div>
                                  <p className="font-bold text-xs">All Students</p>
                                  <p className={`text-[10px] mt-0.5 ${selectedRecordingsStudentEmail === null ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                    Overview & Pending Tasks
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 opacity-75" />
                            </button>

                            {filteredList.map(item => {
                              const isSelected = selectedRecordingsStudentEmail === item.email;
                              return (
                                <button
                                  key={item.email}
                                  onClick={() => handleStudentClick(item.email)}
                                  className={`w-full p-4 rounded-xl text-left transition-all border cursor-pointer ${
                                    isSelected 
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.01]' 
                                      : 'bg-white hover:bg-neutral-50 border-neutral-100'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5 truncate">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shrink-0 ${
                                        isSelected ? 'bg-blue-700 text-white' : 'bg-neutral-100 text-neutral-600'
                                      }`}>
                                        {item.email[0]}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-bold text-xs truncate max-w-[130px]" title={item.email}>{item.email}</p>
                                        {item.displayName && (
                                          <p className={`text-[10px] truncate ${isSelected ? 'text-blue-200' : 'text-neutral-400'}`}>
                                            {item.displayName}
                                          </p>
                                        )}
                                        {item.lastSubmittedText && (
                                          <p className={`text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded ${
                                            isSelected ? 'bg-blue-700 text-blue-150' : 'bg-neutral-100 text-neutral-500'
                                          }`}>
                                            Last: {item.lastSubmittedText} ago
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="text-right shrink-0 ml-1.5">
                                      <p className="text-[10px] font-bold">
                                        <span className={item.pendingCount > 0 ? (isSelected ? 'text-white' : 'text-orange-600 font-extrabold') : isSelected ? 'text-white/80' : 'text-neutral-400'}>
                                          {item.pendingCount}
                                        </span>
                                        <span className={isSelected ? 'text-white/60' : 'text-neutral-300'}>/</span>
                                        <span className={isSelected ? 'text-white/95' : 'text-neutral-500'}>
                                          {item.totalCount}
                                        </span>
                                      </p>
                                      {item.pendingCount > 0 && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse mt-1" />
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            
                            {filteredList.length === 0 && (
                              <div className="text-center py-10 bg-neutral-50 rounded-xl text-neutral-400 text-xs italic">
                                No students found.
                              </div>
                            )}
                          </div>
                          
                          {hasMoreRecordings && (
                            <button 
                              onClick={loadMoreRecordings}
                              disabled={isLoadingMore}
                              className="w-full py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/60 rounded-xl text-[10px] font-black uppercase text-neutral-700 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
                            >
                              <RefreshCcw className={`w-3.5 h-3.5 ${isLoadingMore ? 'animate-spin' : ''}`} />
                              {isLoadingMore ? "Synchronizing..." : "Sync More Database Records"}
                            </button>
                          )}
                        </div>

                        {/* RIGHT COLUMN: Detail Panel (Col span 8) */}
                        <div className="lg:col-span-8 bg-white rounded-3xl border border-neutral-200/85 p-6 min-h-[500px]">
                          {!selectedRecordingsStudentEmail ? (
                            <div className="space-y-6 animate-in fade-in duration-350">
                              <div>
                                <h3 className="text-xl font-bold font-display text-neutral-900 leading-tight">All Students Overview</h3>
                                <p className="text-xs text-neutral-500 mt-1">
                                  Global metrics compiled from {recordings.length} loaded records.
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-5 bg-neutral-50 border border-neutral-100 rounded-2xl">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Submissions</p>
                                  <p className="text-3xl font-black text-neutral-900 mt-1">{recordings.length}</p>
                                </div>
                                <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-400">Pending Feedback</p>
                                  <p className="text-3xl font-black text-orange-600 mt-1">
                                    {recordings.filter(r => r.status !== 'reviewed').length}
                                  </p>
                                </div>
                                <div className="p-5 bg-green-50 border border-green-100 rounded-2xl">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-green-400">Completed Reviews</p>
                                  <p className="text-3xl font-black text-green-600 mt-1">
                                    {recordings.filter(r => r.status === 'reviewed').length}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5 mt-2">
                                  <Volume2 className="w-3.5 h-3.5" /> Recent Students with Pending Tasks
                                </h4>
                                
                                <div className="space-y-2">
                                  {list.filter(s => s.pendingCount > 0).slice(0, 10).map(s => (
                                    <button
                                      key={s.email}
                                      onClick={() => handleStudentClick(s.email)}
                                      className="w-full p-4 hover:bg-neutral-50 border border-neutral-100 rounded-2xl flex items-center justify-between text-left transition-all hover:border-neutral-900 active:scale-[0.99] cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                                        <div>
                                          <p className="font-bold text-xs text-neutral-900">{s.email}</p>
                                          {s.displayName && <p className="text-[10px] text-neutral-400">{s.displayName}</p>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-1 bg-orange-50 text-orange-600 text-[9px] font-black rounded-lg uppercase">
                                          {s.pendingCount} TO REVIEW
                                        </span>
                                        <span className="text-xs text-neutral-400">➔</span>
                                      </div>
                                    </button>
                                  ))}
                                  
                                  {list.filter(s => s.pendingCount > 0).length === 0 && (
                                    <div className="p-8 text-center bg-green-50/20 border border-green-100/50 rounded-2xl text-green-700">
                                      <p className="text-xs font-bold">🎉 Excellent! No pending recordings to review.</p>
                                      <p className="text-[10px] text-green-600 mt-1">All submitted student practice tests are up-to-date.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-6 animate-in fade-in duration-350">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black rounded uppercase tracking-wider">
                                      Active Student
                                    </span>
                                    {selectedStudentDisplayName && (
                                      <span className="text-xs font-black text-neutral-500">
                                        {selectedStudentDisplayName}
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="text-base font-black font-display text-neutral-900 mt-1 truncate" title={selectedRecordingsStudentEmail}>
                                    {selectedRecordingsStudentEmail}
                                  </h3>
                                </div>
                                
                                <button
                                  onClick={() => {
                                    setSelectedRecordingsStudentEmail(null);
                                    setActiveStudentRecordings([]);
                                  }}
                                  className="px-3.5 py-2 border border-neutral-200 hover:border-neutral-950 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap cursor-pointer hover:bg-neutral-50"
                                >
                                  ← View All Students
                                </button>
                              </div>

                              <div className="flex justify-between items-center bg-neutral-50 p-2 rounded-2xl">
                                <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider pl-2">
                                  Practice Feed
                                </span>
                                <div className="flex bg-white shadow-sm p-1 rounded-xl border border-neutral-200 gap-1">
                                  {(['all', 'pending', 'reviewed'] as const).map(f => (
                                    <button
                                      key={f}
                                      onClick={() => setStatusFilter(f)}
                                      className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        statusFilter === f 
                                          ? 'bg-neutral-900 text-white shadow-sm' 
                                          : 'text-neutral-500 hover:bg-neutral-50 bg-transparent'
                                      }`}
                                    >
                                      {f}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {isLoadingActiveStudent ? (
                                <div className="py-20 text-center text-neutral-400 flex flex-col items-center justify-center gap-3">
                                  <RefreshCcw className="w-8 h-8 animate-spin text-blue-600" />
                                  <p className="text-xs font-bold font-display">Retrieving student recordings...</p>
                                </div>
                              ) : compiledStudentRecs.length === 0 ? (
                                <div className="p-12 text-center border-2 border-dashed border-neutral-100 rounded-[2rem] text-neutral-400 space-y-2">
                                  <Volume2 className="w-8 h-8 mx-auto opacity-20" />
                                  <p className="font-bold text-xs">No recordings match this filter.</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {compiledStudentRecs.map(rec => (
                                    <div 
                                      key={rec.id}
                                      className={`bg-white rounded-2xl border p-5 space-y-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${
                                        playingRecordingId === rec.id 
                                          ? 'border-blue-500 ring-1 ring-blue-500' 
                                          : 'border-neutral-200'
                                      }`}
                                    >
                                      {playingRecordingId === rec.id && (
                                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden">
                                          <motion.div 
                                            initial={{ x: '-100%' }}
                                            animate={{ x: '100%' }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                            className="w-1/2 h-full bg-blue-500"
                                          />
                                        </div>
                                      )}
                                      
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-[9px] font-black uppercase tracking-wider rounded-md">
                                              {rec.topic}
                                            </span>
                                            {rec.status === 'reviewed' ? (
                                              <span className="flex items-center gap-1 text-[9px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-md">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Reviewed
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md animate-pulse">
                                                Pending Review
                                              </span>
                                            )}
                                            {rec.createdAt && (
                                              <span className="text-[9px] text-neutral-400">
                                                {formatTimestamp(rec.createdAt)}
                                              </span>
                                            )}
                                          </div>
                                          <p className="font-bold text-neutral-900 text-sm leading-snug">{rec.questionText}</p>
                                          {rec.duration && <p className="text-[9px] text-neutral-400 mt-0.5 font-mono">Duration: {rec.duration}s</p>}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 shrink-0">
                                          {rec.audioUrl && (
                                            <a 
                                              href={rec.audioUrl} 
                                              download 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="p-2.5 rounded-xl bg-neutral-50 text-neutral-500 hover:bg-neutral-150 hover:text-neutral-800 transition-all border border-neutral-100"
                                              title="Download recording"
                                            >
                                              <Download className="w-4 h-4" />
                                            </a>
                                          )}
                                          
                                          {(!rec.audioUrl && !rec.audioBase64 && !rec.hasAudio) ? (
                                            <div className="px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg text-[9px] font-black text-red-500 uppercase tracking-widest whitespace-nowrap">
                                              No Audio
                                            </div>
                                          ) : (
                                            <button 
                                              onClick={() => playRecording(rec)}
                                              className={`p-2.5 rounded-xl transition-all shadow-sm cursor-pointer ${
                                                playingRecordingId === rec.id && isPlaying 
                                                  ? 'bg-blue-600 text-white shadow-md' 
                                                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                                              }`}
                                            >
                                              {playingRecordingId === rec.id && isPlaying ? (
                                                <Pause className="w-4 h-4 fill-current animate-pulse" />
                                              ) : (
                                                <Play className="w-4 h-4 fill-current" />
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      <div className={`p-4 rounded-xl border ${rec.status === 'reviewed' ? 'bg-neutral-50/80 border-neutral-100' : 'bg-blue-50/20 border-blue-100/50'}`}>
                                        <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">
                                          <MessageSquare className="w-3.5 h-3.5" /> 
                                          Advice (Chinese Suggestions)
                                        </h4>
                                        
                                        <div className="space-y-2">
                                          <textarea 
                                            value={adminFeedback[rec.id!] !== undefined ? adminFeedback[rec.id!] : (rec.teacherFeedback || '')}
                                            onChange={(e) => setAdminFeedback({...adminFeedback, [rec.id!]: e.target.value})}
                                            placeholder="Introduce corrections, fluency feedback, and tips in Chinese here..."
                                            className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-black min-h-[70px] placeholder:text-neutral-300 shadow-inner"
                                          />
                                          <div className="flex justify-end">
                                            <button 
                                              onClick={() => submitFeedback(rec.id!)}
                                              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                                (adminFeedback[rec.id!] !== undefined ? adminFeedback[rec.id!] : (rec.teacherFeedback || '')).trim().length > 0
                                                  ? 'bg-neutral-950 text-white hover:bg-neutral-800 shadow-sm active:scale-95'
                                                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                              }`}
                                              disabled={!(adminFeedback[rec.id!] !== undefined ? adminFeedback[rec.id!] : (rec.teacherFeedback || '')).trim().length}
                                            >
                                              {rec.status === 'reviewed' ? 'Save Feedback' : 'Save & Mark Reviewed'}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
            : (
                  // Original Flat View for Students
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recordings.map((rec) => (
                      <div 
                        key={rec.id} 
                        className={`bg-white p-6 rounded-[2rem] border transition-all duration-300 relative overflow-hidden ${
                          playingRecordingId === rec.id ? 'border-blue-500 shadow-lg ring-1 ring-blue-500' : 'border-neutral-200 shadow-sm'
                        }`}
                      >
                        {playingRecordingId === rec.id && (
                          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden">
                            <motion.div 
                              initial={{ x: '-100%' }}
                              animate={{ x: '100%' }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                              className="w-1/2 h-full bg-blue-500"
                            />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-xs font-black uppercase text-blue-600 mb-1">{rec.topic} {rec.duration ? `· ${rec.duration}s` : ''}</p>
                            <p className="font-bold text-neutral-900 mb-2 truncate" title={rec.questionText}>{rec.questionText}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {rec.audioUrl && (
                              <a 
                                href={rec.audioUrl} 
                                download 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-3 rounded-xl bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-all"
                                title="Download recording"
                              >
                                <Download className="w-5 h-5" />
                              </a>
                            )}
                            
                            {(!rec.audioUrl && !rec.audioBase64 && !rec.hasAudio) ? (
                              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black text-red-500 uppercase tracking-widest whitespace-nowrap">
                                No audio data
                              </div>
                            ) : (
                              <button 
                                onClick={() => playRecording(rec)}
                                className={`p-3 rounded-xl transition-all shadow-sm ${
                                  playingRecordingId === rec.id && isPlaying ? 'bg-blue-600 text-white shadow-lg' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                                }`}
                              >
                                {playingRecordingId === rec.id && isPlaying ? (
                                  <Pause className="w-5 h-5 fill-current" />
                                ) : (
                                  <Play className="w-5 h-5 fill-current" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className={`p-5 rounded-2xl border ${rec.status === 'reviewed' ? 'bg-green-50 border-green-100' : 'bg-neutral-50 border-neutral-100'}`}>
                          <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400 mb-3">
                            <MessageSquare className="w-4 h-4" /> 
                            Teacher Feedback
                          </h4>
                          <p className={`text-sm leading-relaxed ${rec.teacherFeedback ? 'text-neutral-800' : 'text-neutral-400 italic'}`}>
                            {rec.teacherFeedback || "Review pending... your teacher will listen and provide tips soon."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>
      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-8 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold font-display">Batch Import JSON ({importType === 'part1' ? 'Part 1: Questions + Answers' : 'Part 2: Personal Answers'})</h3>
                  <p className="text-neutral-500 text-sm">Target Topic: <span className="font-bold text-neutral-900">{selectedTopic}</span></p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-neutral-100 rounded-full"><X /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2 block">JSON Data</label>
                    <textarea 
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      placeholder="Paste your JSON here..."
                      className="w-full h-[300px] p-4 font-mono text-xs border border-neutral-200 rounded-2xl outline-none focus:border-black"
                    />
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <h5 className="text-[10px] font-black uppercase text-neutral-400 mb-2">Example Format</h5>
                    <pre className="text-[10px] text-neutral-500 overflow-x-auto">
                      {importType === 'part1' ? 
                        JSON.stringify([
                          { id: "topic_q1", question: "Describe your family member.", suggestedAnswer: "I would like to talk about my daughter..." },
                          { id: "topic_q2", question: "What do you do together?", suggestedAnswer: "We often go to the park..." }
                        ], null, 2) :
                        JSON.stringify({
                          "festivals_q1": "I love Spring Festival because we have big dinners.",
                          "festivals_q2": "Last year I visited my grandmother in Beijing."
                        }, null, 2)
                      }
                    </pre>
                  </div>
                  <button 
                    onClick={handleImportPreview}
                    className="w-full py-3 bg-neutral-900 text-white font-bold rounded-xl text-sm"
                  >
                    Preview Import
                  </button>
                  {importError && <p className="text-xs text-red-500 font-bold">{importError}</p>}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2 block">Preview ({importPreview.length} items)</label>
                  <div className="border border-neutral-100 rounded-2xl h-[450px] overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
                    {importPreview.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-neutral-300 italic text-sm text-center">
                        Click Preview to see data
                      </div>
                    ) : importType === 'part1' ? (
                      importPreview.map((p, i) => (
                        <div key={i} className="p-3 bg-white rounded-xl border border-neutral-200 shadow-sm text-xs">
                          <p className="font-bold mb-1 text-blue-600">ID: {p.id}</p>
                          <p className="text-neutral-900 font-bold mb-1">Q: {p.question}</p>
                          <p className="italic text-neutral-500 bg-neutral-50 p-2 rounded-lg mt-2">A: {p.suggestedAnswer}</p>
                        </div>
                      ))
                    ) : (
                      importPreview.map(([id, ans], i) => (
                        <div key={i} className="p-3 bg-white rounded-xl border border-neutral-200 shadow-sm text-xs">
                          <p className="font-bold mb-1 text-blue-600">Question ID: {id}</p>
                          <p className="italic text-neutral-800 bg-neutral-50 p-2 rounded-lg">Response: {ans}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t flex justify-end gap-4 bg-neutral-50">
                <button onClick={() => setShowImportModal(false)} className="px-6 py-2 text-sm font-bold text-neutral-500">Cancel</button>
                <button 
                  disabled={!importPreview.length}
                  onClick={executeImport}
                  className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm disabled:opacity-30 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save to Student Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  function currentTopic() {
    return currentQuestion?.topic || "";
  }
}
