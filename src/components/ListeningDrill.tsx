import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, Play, Pause, RefreshCw, HelpCircle, ChevronLeft, 
  BookOpen, Sparkles, AlertCircle, Shuffle, Eye, EyeOff, 
  ArrowLeft, ArrowRight, VolumeX, List, X, ChevronDown, Menu,
  Lock, Unlock, Repeat, Check, CheckSquare, Volume1, Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Mascot from './Mascot';
import { 
  QuestionAnswer, 
  TRINITY_B1_TOPICS, 
  TOPIC_EXPANSION_BANK, 
  TopicExpansion, 
  ExpansionQuestion,
  B1_QUESTIONS
} from '../constants';
import { ListeningMetadata, ListeningMarked, saveListeningMark } from '../services/firebaseService';

interface ListeningDrillProps {
  user: any;
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  displayQuestions: QuestionAnswer[];
  listeningMetadata: ListeningMetadata[];
  listeningMarks?: ListeningMarked[];
  isAdmin?: boolean;
  onBackToLobby?: () => void;
  onJumpToSpeaking?: (questionId: string, topic: string) => void;
}

type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Basic Family Information": "家庭基本状况",
  "Living Situation": "居住环境 (房子/公寓)",
  "Duration and UK Life": "在英生活与时长",
  "Daily Family Life": "日常家庭生活与分工",
  "Family Activities": "家庭共同活动",
  "Children and School": "子女在英上学与备考",
  "Preferences": "两难选择倾向 (外出/在家)",
  "Reasons and Opinions": "主观态度与家庭意义",
  "Recent and Past Experience": "过去与近期特别经历",
  "Future Plans": "未来家庭出行计划",
};

export default function ListeningDrill({
  user,
  selectedTopic,
  setSelectedTopic,
  displayQuestions,
  listeningMetadata,
  listeningMarks = [],
  isAdmin,
  onBackToLobby,
  onJumpToSpeaking
}: ListeningDrillProps) {
  // Tabs: 'topic' or 'expansion'
  const [activeTab, setActiveTab] = useState<'topic' | 'expansion'>('topic');

  // Collapsible sidebar menu open state (collapsed by default for minimalist redesign)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Responsive state sync - starting collapsed
  useEffect(() => {
    setIsSidebarOpen(false);
  }, []);

  // Dropdown states
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState<boolean>(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

  // Left sidebar collapsible sections
  const [isPart1Expanded, setIsPart1Expanded] = useState<boolean>(true);
  const [isPart2Expanded, setIsPart2Expanded] = useState<boolean>(true);
  const [isExtraExpanded, setIsExtraExpanded] = useState<boolean>(true);

  // Help panel state
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // --- STUDENT MARKED SETS & NEED PRACTICE FILTERING ---
  const [showMarkedOnly, setShowMarkedOnly] = useState<boolean>(false);

  const markedQuestionIds = new Set(
    (listeningMarks || [])
      .filter((m) => m.userId === user?.uid && m.marked)
      .map((m) => m.questionId)
  );

  // Standard exam topic list groupings
  const part1Topics = ["My daughter", "My cats", "My husband", "Family activities", "My house"];
  const part2Topics = TRINITY_B1_TOPICS.filter(t => !part1Topics.includes(t));

  // --- STATE FOR TAB A: Topic Question Listening ---
  const rawTopicQuestions = displayQuestions.filter(q => q.topic === selectedTopic);
  const filteredTopicQuestions = showMarkedOnly
    ? rawTopicQuestions.filter(q => markedQuestionIds.has(q.id))
    : rawTopicQuestions;
  const [topicQuestionIdx, setTopicQuestionIdx] = useState<number>(0);

  // --- STATE FOR TAB B: Topic Expansion Bank (Family Focused Category Drill) ---
  const activeExpansionTopic = TOPIC_EXPANSION_BANK[0];
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expansionQuestionIdx, setExpansionQuestionIdx] = useState<number>(0);

  // Dynamically extract all available categories in the "My Family" expansion
  const categoriesList = activeExpansionTopic
    ? Array.from(new Set(activeExpansionTopic.expansionQuestions.map(q => q.category).filter(Boolean)))
    : [];

  const rawExpansionQuestions = activeExpansionTopic
    ? (selectedCategory === 'All'
        ? activeExpansionTopic.expansionQuestions
        : activeExpansionTopic.expansionQuestions.filter(q => q.category === selectedCategory))
    : [];
  const filteredExpansionQuestions = showMarkedOnly
    ? rawExpansionQuestions.filter(q => markedQuestionIds.has(q.id))
    : rawExpansionQuestions;

  // --- SHARED PLAYING & DISPLAY CONTROLS ---
  const [playbackSpeed, setPlaybackSpeed] = useState<'normal' | 'slow'>('normal');
  const [isTextVisible, setIsTextVisible] = useState<boolean>(false);
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [activeStep, setActiveStep] = useState<'blind' | 'reveal'>('blind');
  const [isSpeakLoopEnabled, setIsSpeakLoopEnabled] = useState<boolean>(false);
  const isSpeakLoopEnabledRef = useRef<boolean>(false);

  // --- EXAMINER QUESTION TRAINING UNIFIED STATES ---
  const [trainingStep, setTrainingStep] = useState<1 | 2 | 3>(1);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [checkState, setCheckState] = useState<'idle' | 'correct' | 'try_again'>('idle');
  const [shuffledPool, setShuffledPool] = useState<string[]>([]);
  const [showAnswerInStep2, setShowAnswerInStep2] = useState<boolean>(false);

  // Auto reset the showAnswerInStep2 state when questions or steps change
  useEffect(() => {
    setShowAnswerInStep2(false);
  }, [topicQuestionIdx, expansionQuestionIdx, activeTab, trainingStep]);

  // Legacy fallback aliases for structural reference compatibility
  const drillMode = 'listen' as any;
  const builderStep = trainingStep as any;
  const setBuilderStep = (val: any) => setTrainingStep(val);
  const subQuestionIdx = 0 as any;
  const setSubQuestionIdx = (val: any) => {};
  const subQuestions = [] as any[];
  const currentSubQuestion = { questionText: '', wordPool: [] } as any;

  const [mascotOffset, setMascotOffset] = useState({ x: 0, y: 0 });
  const playerCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isSpeakLoopEnabledRef.current = isSpeakLoopEnabled;
  }, [isSpeakLoopEnabled]);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentPlayId = useRef<number>(0);
  const loopTimeoutRef = useRef<any>(null);
  const ttsFallbackQuestionsRef = useRef<Set<string>>(new Set());

  // Force TTS fallback cleanup when transitioning questions
  useEffect(() => {
    ttsFallbackQuestionsRef.current.clear();
  }, [topicQuestionIdx, expansionQuestionIdx, activeTab]);

  // Sync index boundaries on active list transformations
  useEffect(() => {
    setTopicQuestionIdx(0);
    setIsTextVisible(false);
    setActiveStep('blind');
    stopActiveAudio();
    setIsTopicDropdownOpen(false);
    setTrainingStep(1);
    setSelectedIndices([]);
    setCheckState('idle');
  }, [selectedTopic]);

  useEffect(() => {
    setExpansionQuestionIdx(0);
    setIsTextVisible(false);
    setActiveStep('blind');
    stopActiveAudio();
    setIsCategoryDropdownOpen(false);
    setTrainingStep(1);
    setSelectedIndices([]);
    setCheckState('idle');
  }, [selectedCategory]);

  useEffect(() => {
    // Hide text representation when transitioning questions within any collection
    setIsTextVisible(false);
    setActiveStep('blind');
    stopActiveAudio();
    setTrainingStep(1);
    setSelectedIndices([]);
    setCheckState('idle');
  }, [topicQuestionIdx, expansionQuestionIdx, activeTab]);

  // Clamp boundaries if switching list filters causes out-of-bounds selection
  useEffect(() => {
    if (topicQuestionIdx >= filteredTopicQuestions.length && filteredTopicQuestions.length > 0) {
      setTopicQuestionIdx(filteredTopicQuestions.length - 1);
    }
  }, [filteredTopicQuestions.length, topicQuestionIdx]);

  useEffect(() => {
    if (expansionQuestionIdx >= filteredExpansionQuestions.length && filteredExpansionQuestions.length > 0) {
      setExpansionQuestionIdx(filteredExpansionQuestions.length - 1);
    }
  }, [filteredExpansionQuestions.length, expansionQuestionIdx]);

  // When the filter state changes, start from the first element
  useEffect(() => {
    setTopicQuestionIdx(0);
    setExpansionQuestionIdx(0);
    setIsTextVisible(false);
    setActiveStep('blind');
    stopActiveAudio();
    setTrainingStep(1);
    setSelectedIndices([]);
    setCheckState('idle');
  }, [showMarkedOnly]);

  // Clean up playback on component unmount
  useEffect(() => {
    return () => {
      stopActiveAudio();
    };
  }, []);

  // --- QUESTION PARSING UTILITIES ---
  // Extract main question before the parenthesis
  function cleanQuestionText(fullText: string): string {
    if (!fullText) return '';
    const idx = fullText.indexOf('(');
    if (idx === -1) return fullText.trim();
    return fullText.slice(0, idx).trim();
  }

  // Extract variants enclosed in parentheses, separated by /
  function getAlternatives(fullText: string): string[] {
    if (!fullText) return [];
    const startIdx = fullText.indexOf('(');
    if (startIdx === -1) return [];
    const endIdx = fullText.lastIndexOf(')');
    if (endIdx === -1 || endIdx <= startIdx) return [];
    const inside = fullText.slice(startIdx + 1, endIdx);
    return inside
      .split('/')
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  // Find overrides configured inside teacher dashboard
  function getMetadataOverride(questionId: string): ListeningMetadata | undefined {
    return listeningMetadata.find(m => m.id === questionId);
  }

  // --- QUESTION SIGNAL AND DISTRACTORS AUTO GENERATOR ---
  function getQuestionSignalAndDistractors(questionText: string): { signal: string; chinese: string; distractors: string[] } {
    const lower = questionText.toLowerCase();
    
    // Default dynamic distractors list that are grammatical/semantic distractors
    let distractors: string[] = ['did', 'do', 'often', 'where'];

    if (lower.includes('how long')) {
      return {
        signal: 'How long',
        chinese: '问时间长度/时长',
        distractors: ['often', 'since', 'where', 'did']
      };
    }
    if (lower.includes('how often')) {
      return {
        signal: 'How often',
        chinese: '问频率/频次',
        distractors: ['long', 'why', 'times', 'ever']
      };
    }
    if (lower.includes('why')) {
      return {
        signal: 'Why',
        chinese: '问原因/理由',
        distractors: ['what', 'when', 'how', 'do']
      };
    }
    if (lower.includes('prefer') || lower.includes('would you rather')) {
      return {
        signal: 'Do you prefer',
        chinese: '问偏好/对比抉择',
        distractors: ['are', 'have', 'ever', 'will']
      };
    }
    if (lower.includes('have you ever') || lower.includes('has anyone')) {
      return {
        signal: 'Have you ever',
        chinese: '问人生经历 (现在完成时)',
        distractors: ['did', 'are', 'do', 'would']
      };
    }
    if (lower.includes('what kind of') || lower.includes('what type of') || lower.includes('what sort of')) {
      return {
        signal: 'What kind of',
        chinese: '问门类/类型',
        distractors: ['who', 'how', 'where', 'which']
      };
    }
    if (lower.includes('when')) {
      return {
        signal: 'When',
        chinese: '问时间点/时段',
        distractors: ['where', 'why', 'who', 'did']
      };
    }
    if (lower.includes('where')) {
      return {
        signal: 'Where',
        chinese: '问地点/位置',
        distractors: ['when', 'why', 'who', 'did']
      };
    }
    if (lower.includes('who')) {
      return {
        signal: 'Who',
        chinese: '问人物关系',
        distractors: ['where', 'how', 'why', 'what']
      };
    }
    if (lower.includes('how many')) {
      return {
        signal: 'How many',
        chinese: '问数量',
        distractors: ['much', 'long', 'often', 'are']
      };
    }
    if (lower.includes('do you') || lower.includes('does')) {
      return {
        signal: 'Do you...',
        chinese: '一般疑问句 (问看法与日常习惯)',
        distractors: ['have', 'are', 'did', 'would']
      };
    }

    // Default Topic-based matching triggers
    if (lower.includes('family') || lower.includes('husband') || lower.includes('children') || lower.includes('cats') || lower.includes('daughter')) {
      distractors = ['house', 'prefer', 'job', 'often'];
    } else if (lower.includes('house') || lower.includes('live') || lower.includes('flat') || lower.includes('room')) {
      distractors = ['family', 'school', 'work', 'long'];
    }

    return {
      signal: 'Question word / Auxiliary',
      chinese: '特定常考句型与核心问词',
      distractors: distractors.slice(0, 3)
    };
  }

  // --- ACTIVE DATA RESOLUTION ---
  const currentTopicQuestion: QuestionAnswer | undefined = filteredTopicQuestions[topicQuestionIdx];
  const currentExpansionQuestion = filteredExpansionQuestions[expansionQuestionIdx];
  const currentQuestion = activeTab === 'topic' ? currentTopicQuestion : currentExpansionQuestion;
  const isActiveMarked = currentQuestion ? markedQuestionIds.has(currentQuestion.id) : false;

  const activeQuestionText = activeTab === 'topic' 
    ? (currentTopicQuestion?.question || '') 
    : (currentExpansionQuestion?.question || '');

  const activeMainSentence = cleanQuestionText(activeQuestionText);
  const activeAlternatives = getAlternatives(activeQuestionText);

  // --- SHUFFLED WORD POOL PREPARATION ---
  useEffect(() => {
    if (!activeMainSentence) {
      setShuffledPool([]);
      setSelectedIndices([]);
      setCheckState('idle');
      return;
    }
    // Extract clean words from activeMainSentence (remove common punctuation marks)
    const cleanWords = activeMainSentence
      .replace(/[?!.,]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    // Get dynamic distractors
    const { distractors } = getQuestionSignalAndDistractors(activeMainSentence);

    // Combine pool
    const combined = [...cleanWords, ...distractors];

    // Shuffle
    const shuffled = [...combined].sort(() => Math.random() - 0.5);
    setShuffledPool(shuffled);
    setSelectedIndices([]);
    setCheckState('idle');
  }, [activeMainSentence, trainingStep === 2]);

  // --- MASCOT SPEECH BUBBLE GENERATOR (Companion Feeling) ---
  const getCurrentMascotBubble = (): string => {
    if (!currentQuestion) {
      return "Hi there! Welcome to the Nova Examiner Studio. Choose a question on the left to start!";
    }
    
    if (playbackSpeed === 'slow') {
      return "Slow-motion mode is active! Listen closely to catch those fast consonant joins and reductions.";
    }

    if (activeStep === 'blind') {
      if (audioState === 'playing') {
        return isSpeakLoopEnabled 
          ? "SpeakLoop is active! Listen to the repeat pattern, close your eyes, and try to mimic the native flow."
          : "Keep those eyes shut! Try to capture every syllable in your head.";
      }
      return isSpeakLoopEnabled
        ? "SpeakLoop is ready. Turn up your volume to begin the loop rhythm!"
        : "Blind ear challenge! Tap Play and decode the sentence entirely from sound.";
    } else {
      // Reveal step
      if (isActiveMarked) {
        return "This phrase is flagged in your practice card list! Speak it out loud 3 times to build muscle memory.";
      }
      return "Awesome work. Compare your mental draft with the text. Did you spot all the weak sounds?";
    }
  };

  const handleToggleMark = async () => {
    if (!currentQuestion || !user) return;
    const isCurrentlyMarked = markedQuestionIds.has(currentQuestion.id);
    await saveListeningMark({
      userId: user.uid,
      studentEmail: user.email || '',
      questionId: currentQuestion.id,
      topic: (currentQuestion as any).topic || selectedTopic || 'My Family',
      marked: !isCurrentlyMarked
    });
  };

  // --- AUDIO ACTIONS ---
  const stopActiveAudio = () => {
    currentPlayId.current += 1;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setAudioState('idle');
    setErrorMessage('');
  };

  const handlePlayPauseToggle = () => {
    if (audioState === 'playing' || audioState === 'loading') {
      stopActiveAudio();
      return;
    }

    if (audioState === 'paused' && currentAudioRef.current) {
      currentPlayId.current += 1;
      const playId = currentPlayId.current;
      
      currentAudioRef.current.play().then(() => {
        if (playId === currentPlayId.current) {
          setAudioState('playing');
        } else {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
          }
        }
      }).catch(() => {
        if (playId === currentPlayId.current) {
          setAudioState('error');
        }
      });
      return;
    }

    // Otherwise, initiate playing from scratch
    playActiveQuestion();
  };

  const playActiveQuestion = () => {
    // Automatically hide question text when playing starts to prevent listening and seeing simultaneously
    // unless the study state is already in "reveal text" stage
    if (activeStep !== 'reveal') {
      setIsTextVisible(false);
    }
    stopActiveAudio();
    
    const playId = currentPlayId.current;
    const qId = currentQuestion?.id || '';

    setAudioState('loading');

    let textToSpeak = '';
    let targetAudioUrl = '';

    if (activeTab === 'topic') {
      if (!currentTopicQuestion) {
        setAudioState('error');
        return;
      }
      textToSpeak = cleanQuestionText(currentTopicQuestion.question);
      
      // Look up if this question text is customized from its default static value in constants
      const originalQ = B1_QUESTIONS.find(bq => bq.id === currentTopicQuestion.id);
      const isCustomizedText = originalQ && originalQ.question !== currentTopicQuestion.question;

      const meta = getMetadataOverride(currentTopicQuestion.id);
      if (meta) {
        targetAudioUrl = playbackSpeed === 'slow' 
          ? (meta.slowAudioUrl || meta.normalAudioUrl) 
          : (meta.normalAudioUrl || currentTopicQuestion.audioUrl);
      } else if (isCustomizedText) {
        // If the teacher customized the text but hasn't explicitly set metadata,
        // we try the custom generated audio file /audio/[id].wav.
        // If that is missing, the player's onerror will automatically fallback to reading the customized text via TTS!
        targetAudioUrl = `/audio/${currentTopicQuestion.id}.wav`;
      } else {
        targetAudioUrl = currentTopicQuestion.audioUrl;
      }
    } else {
      if (!currentExpansionQuestion) {
        setAudioState('error');
        return;
      }
      textToSpeak = currentExpansionQuestion.question;
      targetAudioUrl = playbackSpeed === 'slow' 
        ? (currentExpansionQuestion.slowAudioUrl || `/audio/${currentExpansionQuestion.id}.wav`)
        : (currentExpansionQuestion.normalAudioUrl || `/audio/${currentExpansionQuestion.id}.wav`);
    }

    // If we have already fallen back to TTS for this question, stick with it!
    if (qId && ttsFallbackQuestionsRef.current.has(qId)) {
      triggerTTSPlayback(textToSpeak, playId);
      return;
    }

    if (targetAudioUrl) {
      const audio = new Audio(targetAudioUrl);
      currentAudioRef.current = audio;

      // Force rate settings on load
      audio.playbackRate = playbackSpeed === 'slow' ? 0.65 : 1.0;

      audio.oncanplaythrough = () => {
        if (currentAudioRef.current === audio && playId === currentPlayId.current) {
          audio.playbackRate = playbackSpeed === 'slow' ? 0.65 : 1.0;
          audio.play()
            .then(() => {
              if (currentAudioRef.current === audio && playId === currentPlayId.current) {
                setAudioState('playing');
                audio.playbackRate = playbackSpeed === 'slow' ? 0.65 : 1.0;
              } else {
                audio.pause();
                audio.src = "";
              }
            })
            .catch((err) => {
              console.warn("Audio play rejected, falling back to TTS:", err);
              if (currentAudioRef.current === audio) {
                audio.pause();
                audio.src = "";
                currentAudioRef.current = null;
              }
              if (qId) {
                ttsFallbackQuestionsRef.current.add(qId);
              }
              if (playId === currentPlayId.current) {
                triggerTTSPlayback(textToSpeak, playId);
              }
            });
        }
      };

      audio.onplay = () => {
        if (playId === currentPlayId.current) {
          setAudioState('playing');
          audio.playbackRate = playbackSpeed === 'slow' ? 0.65 : 1.0;
        }
      };

      audio.onpause = () => {
        if (playId === currentPlayId.current) {
          setAudioState('paused');
        }
      };

      audio.onended = () => {
        if (playId === currentPlayId.current) {
          setAudioState('ended');
          if (isSpeakLoopEnabledRef.current) {
            if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
            loopTimeoutRef.current = setTimeout(() => {
              if (isSpeakLoopEnabledRef.current && playId === currentPlayId.current) {
                playActiveQuestion();
              }
            }, 1000);
          }
        }
      };

      audio.onerror = (e) => {
        console.warn("Audio file failed, falling back to browser TTS synthesis.", e);
        if (currentAudioRef.current === audio) {
          audio.pause();
          audio.src = "";
          currentAudioRef.current = null;
        }
        if (qId) {
          ttsFallbackQuestionsRef.current.add(qId);
        }
        if (playId === currentPlayId.current) {
          triggerTTSPlayback(textToSpeak, playId);
        }
      };

      // Load it manually
      audio.load();
    } else {
      // Direct Speech Synthesis fallback
      triggerTTSPlayback(textToSpeak, playId);
    }
  };

  const triggerTTSPlayback = (text: string, playId: number) => {
    try {
      if (playId !== currentPlayId.current) return;

      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.src = "";
        } catch (e) {
          console.error(e);
        }
        currentAudioRef.current = null;
      }

      window.speechSynthesis.cancel();
      const sentence = new SpeechSynthesisUtterance(text);
      sentence.lang = 'en-GB';
      // 1.0 = normal, 0.65 = slow. These are stable and clear rates
      sentence.rate = playbackSpeed === 'slow' ? 0.65 : 1.0;
      sentence.pitch = 1.0;

      // Ensure stable British English voice selection to avoid random switching of genders
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const gbVoice = voices.find(v => v.lang.startsWith('en-GB') || v.lang === 'en-GB' || v.lang.includes('GB'));
        if (gbVoice) {
          sentence.voice = gbVoice;
        } else {
          const enVoice = voices.find(v => v.lang.startsWith('en'));
          if (enVoice) sentence.voice = enVoice;
        }
      }

      sentence.onstart = () => {
        if (playId === currentPlayId.current) {
          setAudioState('playing');
        }
      };

      sentence.onend = () => {
        if (playId === currentPlayId.current) {
          setAudioState('ended');
          if (isSpeakLoopEnabledRef.current) {
            if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
            loopTimeoutRef.current = setTimeout(() => {
              if (isSpeakLoopEnabledRef.current && playId === currentPlayId.current) {
                playActiveQuestion();
              }
            }, 1000);
          }
        }
      };

      sentence.onerror = (evt) => {
        console.error("Speech Synthesis failure", evt);
        if (evt.error !== 'interrupted' && playId === currentPlayId.current) {
          setAudioState('error');
          setErrorMessage('Browser Speech Synthesis failed.');
        }
      };

      // A small browser timeout allows cancellation to flush the queue preceding speaking
      setTimeout(() => {
        if (playId === currentPlayId.current) {
          window.speechSynthesis.speak(sentence);
        }
      }, 60);
    } catch (err: any) {
      if (playId === currentPlayId.current) {
        setAudioState('error');
        setErrorMessage(err.message || 'Audio playback error.');
      }
    }
  };

  // --- NAVIGATION DRIVERS (A: Topic Questions) ---
  const handleTopicPrev = () => {
    if (filteredTopicQuestions.length === 0) return;
    setTopicQuestionIdx(prev => (prev - 1 + filteredTopicQuestions.length) % filteredTopicQuestions.length);
  };

  const handleTopicNext = () => {
    if (filteredTopicQuestions.length === 0) return;
    setTopicQuestionIdx(prev => (prev + 1) % filteredTopicQuestions.length);
  };

  const handleTopicRandom = () => {
    if (filteredTopicQuestions.length <= 1) return;
    let nextIdx = topicQuestionIdx;
    while (nextIdx === topicQuestionIdx) {
      nextIdx = Math.floor(Math.random() * filteredTopicQuestions.length);
    }
    setTopicQuestionIdx(nextIdx);
  };

  // --- NAVIGATION DRIVERS (B: Expansion Questions) ---
  const handleExpansionPrev = () => {
    const qCount = filteredExpansionQuestions.length;
    if (qCount === 0) return;
    setExpansionQuestionIdx(prev => (prev - 1 + qCount) % qCount);
  };

  const handleExpansionNext = () => {
    const qCount = filteredExpansionQuestions.length;
    if (qCount === 0) return;
    setExpansionQuestionIdx(prev => (prev + 1) % qCount);
  };

  const handleExpansionRandom = () => {
    const qCount = filteredExpansionQuestions.length;
    if (qCount <= 1) return;
    let nextIdx = expansionQuestionIdx;
    while (nextIdx === expansionQuestionIdx) {
      nextIdx = Math.floor(Math.random() * qCount);
    }
    setExpansionQuestionIdx(nextIdx);
  };

  const handleSelectQuestion = (idx: number) => {
    if (activeTab === 'topic') {
      setTopicQuestionIdx(idx);
    } else {
      setExpansionQuestionIdx(idx);
    }
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!playerCardRef.current) return;
    const rect = playerCardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // range: -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // range: -0.5 to 0.5
    setMascotOffset({ x: x * 22, y: y * 18 });
  };

  const handleMouseLeave = () => {
    setMascotOffset({ x: 0, y: 0 });
  };

  // --- CURRENT ACTIVE STRINGS REVENUE REUSED FROM HIGHER SCOPE ---

  // --- STREAMLINED SECURE DESIGNER RECONSTRUCTION FOR QUESTION BUILDER STEPS ---
  // --- STREAMLINED SECURE DESIGNER RECONSTRUCTION FOR UNIFIED TRAINING STEPS ---
  const renderNewUnifiedPracticeDeck = () => {
    return (
      <div className="space-y-8 animate-in fade-in duration-305">
        {/* 1. TOP PROGRESS TIMELINE */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-3 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-150 shadow-sm select-none max-w-lg mx-auto">
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold transition-colors ${trainingStep === 1 ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'}`}>1</span>
            <span className={`text-[10px] font-black tracking-wider uppercase transition-colors ${trainingStep === 1 ? 'text-neutral-900 font-extrabold' : 'text-neutral-400'}`}>Blind Listen</span>
          </div>
          <span className="text-neutral-300 text-xs font-bold font-mono">→</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold transition-colors ${trainingStep === 2 ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'}`}>2</span>
            <span className={`text-[10px] font-black tracking-wider uppercase transition-colors ${trainingStep === 2 ? 'text-neutral-900 font-extrabold' : 'text-neutral-400'}`}>Build Question</span>
          </div>
          <span className="text-neutral-300 text-xs font-bold font-mono">→</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold transition-colors ${trainingStep === 3 ? 'bg-blue-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>3</span>
            <span className={`text-[10px] font-black tracking-wider uppercase transition-colors ${trainingStep === 3 ? 'text-blue-600 font-extrabold' : 'text-neutral-400'}`}>Check Analysis</span>
          </div>
        </div>

        {/* 2. DYNAMIC LAYOUT PER ACTIVE trainingStep */}
        <AnimatePresence mode="wait">
          {trainingStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6 text-center py-6"
            >
              <div className="py-12 px-6 flex flex-col items-center justify-center space-y-4">
                <button
                  onClick={handlePlayPauseToggle}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                    audioState === 'playing' ? 'bg-emerald-600 hover:bg-emerald-550 text-white' : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                  }`}
                  title="Play Examiner Question"
                >
                  {audioState === 'playing' ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white pl-0.5" />}
                </button>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-neutral-800 tracking-tight">Step 1: Blind Listen (听力磨耳朵)</h4>
                  <p className="text-xs text-neutral-500 text-center max-w-sm mx-auto leading-relaxed">
                    Try to capture each block of sounds. The transcript, meaning, and model replies are fully hidden to foster raw acoustic comprehension.
                  </p>
                </div>
              </div>

              {/* Controls block */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 select-none">
                <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
                  <button
                    onClick={() => { setPlaybackSpeed('normal'); stopActiveAudio(); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                      playbackSpeed === 'normal' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
                    }`}
                  >
                    1.0x Normal Speed
                  </button>
                  <button
                    onClick={() => { setPlaybackSpeed('slow'); stopActiveAudio(); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                      playbackSpeed === 'slow' ? 'bg-white text-amber-700 shadow-sm' : 'text-neutral-500'
                    }`}
                  >
                    0.65x Slow-mo
                  </button>
                </div>

                <button
                  onClick={() => setIsSpeakLoopEnabled(!isSpeakLoopEnabled)}
                  className={`px-4 py-2 bg-white border rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                    isSpeakLoopEnabled ? 'border-teal-500 text-teal-600 bg-teal-50/40' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Repeat className={`w-3.5 h-3.5 ${isSpeakLoopEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                  <span>Loop Audio</span>
                </button>
              </div>

              <div className="pt-6 border-t border-neutral-100">
                <button
                  onClick={() => {
                    stopActiveAudio();
                    setTrainingStep(2);
                  }}
                  className="w-full sm:w-auto px-10 py-3.5 bg-neutral-950 hover:bg-neutral-850 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow active:scale-98 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  I’m ready, build the question.
                </button>
              </div>
            </motion.div>
          )}

          {trainingStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6 text-left"
            >
              <div className="flex items-center justify-between select-none">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                  Step 2: Build the Question / 拼出你听到的口语问题
                </span>
                
                <button
                  onClick={playActiveQuestion}
                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-neutral-200 transition-all"
                >
                  {audioState === 'playing' ? <Pause className="w-3.5 h-3.5 fill-current animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Listen Again</span>
                </button>
              </div>

              {/* ASSEMBLED TRAY */}
              <div className="p-5 min-h-[96px] bg-neutral-50/60 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-wrap gap-2 items-center justify-start">
                {selectedIndices.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-bold italic w-full text-center py-2 select-none">
                    Click the word tiles below in sequence to assemble the phrase...
                  </p>
                ) : (
                  selectedIndices.map((origIdx, sIdx) => {
                    const word = shuffledPool[origIdx];
                    if (!word) return null;
                    return (
                      <button
                        key={`selected-${sIdx}-${origIdx}`}
                        onClick={() => {
                          setSelectedIndices(selectedIndices.filter((_, idx) => idx !== sIdx));
                          setCheckState('idle');
                        }}
                        className="px-3.5 py-1.5 bg-blue-50 text-blue-950 font-black text-xs rounded-xl border border-blue-200 cursor-pointer shadow-sm select-none active:scale-95 transition-all"
                        title="Click to remove word"
                      >
                        {word}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Word Tiles pool */}
              <div className="space-y-2 select-none">
                <span className="text-[9px] font-black text-neutral-400 block uppercase tracking-wider">Word tiles pool (includes distractors)</span>
                <div className="flex flex-wrap gap-2 p-4 bg-white border border-neutral-200 rounded-2xl min-h-[100px] justify-start shadow-inner">
                  {shuffledPool.map((word, origIdx) => {
                    const isPlaced = selectedIndices.includes(origIdx);
                    return (
                      <button
                        key={`pool-${origIdx}`}
                        onClick={() => {
                          if (!isPlaced) {
                            setSelectedIndices([...selectedIndices, origIdx]);
                            setCheckState('idle');
                          }
                        }}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border select-none transition-all cursor-pointer ${
                          isPlaced
                            ? 'bg-neutral-100 text-neutral-300 border-neutral-200 opacity-20 pointer-events-none'
                            : 'bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 active:scale-95 shadow-sm'
                        }`}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Check Evaluator */}
              {checkState === 'try_again' && (
                <div className="space-y-3 animate-in zoom-in-98 duration-100 select-none">
                  <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50 border-red-200 text-red-800">
                    <div className="flex items-center gap-2">
                      <span className="w-6.5 h-6.5 shrink-0 rounded-full flex items-center justify-center font-black bg-red-100 text-red-600 text-sm">
                        ✗
                      </span>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider">Try again! (顺序有误)</h4>
                        <p className="text-[11px] opacity-90 leading-tight">Your word order does not match the prompt. Please listen again and readjust the tiles.</p>
                      </div>
                    </div>
                    {!showAnswerInStep2 && (
                      <button
                        onClick={() => setShowAnswerInStep2(true)}
                        className="px-3.5 py-1.5 bg-white hover:bg-neutral-50 active:scale-95 text-red-700 hover:text-red-800 border border-red-300 rounded-xl text-[11px] font-black tracking-wide transition-all cursor-pointer whitespace-nowrap shadow-sm align-middle self-start sm:self-auto"
                      >
                        Show Answer / 查看正确句子
                      </button>
                    )}
                  </div>

                  {showAnswerInStep2 && (
                    <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-800 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
                        Correct Question Sentence / 正确句型原文：
                      </span>
                      <p className="text-sm font-extrabold text-neutral-900 leading-relaxed italic">
                        {activeMainSentence}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-neutral-100 select-none">
                <button
                  onClick={() => {
                    stopActiveAudio();
                    setTrainingStep(1);
                  }}
                  className="px-3.5 py-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  ← Back to Listen
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => { setSelectedIndices([]); setCheckState('idle'); }}
                    className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 text-neutral-600 hover:text-neutral-800 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    Reset Board
                  </button>
                  <button
                    onClick={() => {
                      if (!activeMainSentence || selectedIndices.length === 0) return;
                      const correctWords = activeMainSentence
                        .replace(/[?!.,]/g, '')
                        .split(/\s+/)
                        .filter(Boolean)
                        .map(w => w.toLowerCase());
                      const chosenWords = selectedIndices
                        .map(idx => shuffledPool[idx])
                        .filter(Boolean)
                        .map(w => w.toLowerCase());
                      
                      if (correctWords.length !== chosenWords.length) {
                        setCheckState('try_again');
                        return;
                      }
                      const match = correctWords.every((word, idx) => word === chosenWords[idx]);
                      if (match) {
                        setCheckState('correct');
                        setTrainingStep(3);
                      } else {
                        setCheckState('try_again');
                      }
                    }}
                    disabled={selectedIndices.length === 0}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      selectedIndices.length === 0 ? 'bg-neutral-200 text-neutral-400' : 'bg-neutral-900 hover:bg-neutral-850 text-white'
                    }`}
                  >
                    Check
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {trainingStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6 text-left"
            >
              {/* SUCCESS GREETING CARD */}
              <div className="bg-emerald-500/10 p-5 sm:p-6 rounded-2xl border border-emerald-500/30 space-y-4 animate-in zoom-in-98 duration-100">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Correct Question Text / 考官问题原文</span>
                  <h3 className="text-base font-extrabold text-neutral-950 leading-relaxed pr-8">
                    {activeMainSentence}
                  </h3>
                </div>

                {/* Meaning */}
                {(() => {
                  let meaning = '';
                  if (activeTab === 'expansion') {
                    meaning = currentExpansionQuestion?.chineseMeaning || '';
                  } else if (activeTab === 'topic' && currentTopicQuestion) {
                    const meta = listeningMetadata.find(m => m.id === currentTopicQuestion.id);
                    meaning = meta?.chineseMeaning || '';
                  }
                  if (meaning) {
                    return (
                      <div className="pt-3 border-t border-emerald-500/15">
                        <span className="text-[9px] font-bold text-neutral-500 block uppercase tracking-wider">Chinese Meaning / 中文意思</span>
                        <p className="text-xs font-bold text-neutral-700 mt-1 leading-normal">{meaning}</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* QUESTION SIGNAL INSIGHT CARD */}
              {(() => {
                const { signal, chinese } = getQuestionSignalAndDistractors(activeMainSentence);
                return (
                  <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 space-y-3 shadow-inner">
                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Concept analysis (考点分析)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                        <span className="text-[8px] font-black text-neutral-450 block uppercase tracking-wider">Question Signal / 提问信号词</span>
                        <p className="text-xs font-black text-blue-900 font-mono mt-1">{signal || "Examiner Question"}</p>
                      </div>
                      <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                        <span className="text-[8px] font-black text-neutral-450 block uppercase tracking-wider">Aimed Target / 提问考点方向</span>
                        <p className="text-xs font-bold text-neutral-700 mt-1">{chinese || "考查日常英文交流偏好或习惯"}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-100 pt-5 select-none text-xs">
                {/* PRACTICE STATE MARKING */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    onClick={handleToggleMark}
                    className={`px-4 py-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors ${
                      isActiveMarked
                        ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                    }`}
                    title="Add or remove from difficult sets"
                  >
                    <span className="text-sm">★</span>
                    <span>{isActiveMarked ? 'In Practice (已记录)' : 'Mark Need Practice (标记难点)'}</span>
                  </button>

                  {isActiveMarked && (
                    <button
                      onClick={handleToggleMark}
                      className="px-4 py-2.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-700 rounded-xl font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-teal-600 stroke-[3]" />
                      <span>Mastered (掌握)</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      setTrainingStep(1);
                      setSelectedIndices([]);
                      setCheckState('idle');
                      stopActiveAudio();
                    }}
                    className="px-3 py-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3 text-neutral-400" /> Re-drill Question
                  </button>

                  <button
                    onClick={() => {
                      if (activeTab === 'topic') {
                        handleTopicNext();
                      } else {
                        handleExpansionNext();
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-all shadow-sm flex items-center gap-1"
                  >
                    Next Question →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderRedesignedPracticeDeck = () => {
    return renderNewUnifiedPracticeDeck();
  };

  const _unused_old_renderRedesignedPracticeDeck = () => {
    const drillMode = 'listen' as any;
    const builderStep = 1 as any;
    const setBuilderStep = (n: any) => {};
    const subQuestions = [] as any[];
    const subQuestionIdx = 0 as any;
    const setSubQuestionIdx = (n: any) => {};
    const currentSubQuestion = { questionText: '', wordPool: [] } as any;

    if (drillMode === 'listen') {
      return (
        <div className="space-y-6 animate-in fade-in duration-200">
          <AnimatePresence mode="wait">
            {activeStep === 'blind' ? (
              <motion.div
                key="listen-blind"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-center"
              >
                {/* Step 1: Blind Listen only plays question without english script, meaning or suggested answer */}
                <div className="py-12 px-6 flex flex-col items-center justify-center space-y-4">
                  <button
                    onClick={handlePlayPauseToggle}
                    className="w-16 h-16 bg-neutral-900 hover:bg-neutral-850 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    {audioState === 'playing' ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white pl-0.5" />}
                  </button>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-neutral-800">Transcript Hidden / 裸听挑战</h4>
                    <p className="text-xs text-neutral-450 text-center max-w-sm mx-auto">Can you match every sound mentally? Speed & Loop controls are active below.</p>
                  </div>
                </div>

                {/* Speed & Loop Knobs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 select-none">
                  <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200 w-full sm:w-auto">
                    <button
                      onClick={() => { setPlaybackSpeed('normal'); stopActiveAudio(); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        playbackSpeed === 'normal' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      1.0x Real
                    </button>
                    <button
                      onClick={() => { setPlaybackSpeed('slow'); stopActiveAudio(); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        playbackSpeed === 'slow' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      0.65x Slow
                    </button>
                  </div>

                  <button
                    onClick={() => setIsSpeakLoopEnabled(!isSpeakLoopEnabled)}
                    className={`px-4 py-2 bg-white border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                      isSpeakLoopEnabled ? 'border-teal-500 text-teal-600 bg-teal-50/40' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                    }`}
                  >
                    <Repeat className={`w-3.5 h-3.5 ${isSpeakLoopEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                    <span>Loop Audio</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-neutral-100">
                  <button
                    onClick={() => {
                      setActiveStep('reveal');
                      setIsTextVisible(true);
                    }}
                    className="w-full sm:w-auto px-10 py-3.5 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow active:scale-95 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Reveal Transcript & Translate (翻牌脚本校对)
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="listen-reveal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-left"
              >
                {/* Play again knobs */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60 select-none">
                  <button
                    onClick={handlePlayPauseToggle}
                    className="w-full sm:w-auto px-5 py-2 bg-neutral-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {audioState === 'playing' ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                    <span>{audioState === 'playing' ? "Pause" : "Listen Question"}</span>
                  </button>

                  <div className="flex gap-2 items-center w-full sm:w-auto">
                    <div className="inline-flex rounded-xl bg-neutral-200/60 p-0.5 border border-neutral-250 w-full sm:w-auto">
                      <button
                        onClick={() => { setPlaybackSpeed('normal'); stopActiveAudio(); }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${playbackSpeed === 'normal' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
                      >
                        1.0x Real
                      </button>
                      <button
                        onClick={() => { setPlaybackSpeed('slow'); stopActiveAudio(); }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${playbackSpeed === 'slow' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500'}`}
                      >
                        0.65x Slow
                      </button>
                    </div>

                    <button
                      onClick={() => setIsSpeakLoopEnabled(!isSpeakLoopEnabled)}
                      className={`px-3 py-1.5 bg-white border rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-sm ${isSpeakLoopEnabled ? 'border-teal-500 text-teal-600 bg-teal-50/20' : 'border-neutral-200 text-neutral-500'}`}
                    >
                      <Repeat className="w-3 h-3" />
                      <span>Loop</span>
                    </button>
                  </div>
                </div>

                {/* Transcript panel */}
                <div className="bg-blue-50/15 p-6 rounded-2xl border border-blue-105 space-y-4 font-sans">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider">Hearing transcript</span>
                    <h3 className="text-base font-extrabold text-neutral-950 leading-relaxed pr-8">
                      {activeMainSentence}
                    </h3>
                  </div>

                  {/* Translation block */}
                  {(() => {
                    let meaning = "";
                    if (activeTab === 'expansion') {
                      meaning = currentExpansionQuestion?.chineseMeaning || "";
                    } else if (activeTab === 'topic' && currentTopicQuestion) {
                      const meta = listeningMetadata.find(m => m.id === currentTopicQuestion.id);
                      meaning = meta?.chineseMeaning || "";
                    }
                    if (meaning) {
                      return (
                        <div className="pt-3 border-t border-neutral-200/40 animate-in fade-in duration-200">
                          <span className="text-[9px] font-bold text-neutral-400 block uppercase tracking-wider">Chinese Meaning</span>
                          <p className="text-xs font-bold text-neutral-700 mt-1">{meaning}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Need Practice + Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-100 pt-5 select-none">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleToggleMark}
                      className={`px-4 py-2 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                        isActiveMarked ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <span>★</span>
                      <span>{isActiveMarked ? 'In Practice' : 'Mark Need Practice'}</span>
                    </button>

                    {isActiveMarked && (
                      <button
                        onClick={handleToggleMark}
                        className="px-3.5 py-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Mastered</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end font-sans">
                    <button
                      onClick={() => {
                        setActiveStep('blind');
                        setIsTextVisible(false);
                        stopActiveAudio();
                      }}
                      className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Lock className="w-3 h-3 text-neutral-400" />
                      <span>Re-lock (重新裸听)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (activeTab === 'topic') {
                          handleTopicNext();
                        } else {
                          handleExpansionNext();
                        }
                      }}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm"
                    >
                      Next Phrase →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // --- QUESTION BUILDER ---
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <AnimatePresence mode="wait">
          {/* Step 1: Blind Listen */}
          {builderStep === 1 && (
            <motion.div
              key="builder-step-1"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 text-center animate-in fade-in duration-250"
            >
              <div className="py-12 px-6 flex flex-col items-center justify-center space-y-4">
                <button
                  onClick={playActiveQuestion}
                  className="w-16 h-16 bg-blue-50 hover:bg-blue-100 rounded-full flex items-center justify-center border border-blue-200 cursor-pointer text-blue-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  {audioState === 'playing' ? <Pause className="w-6 h-6 text-blue-600" /> : <Play className="w-6 h-6 text-blue-600 fill-blue-600 pr-0" />}
                </button>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-800">Listen carefully to the audio</h4>
                  <p className="text-xs text-neutral-450 text-center max-w-sm mx-auto">Train your sensory ears to hold the syntactic pattern in memory without looking.</p>
                </div>
              </div>

              {/* Speeds */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 select-none">
                <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200 shadow-inner">
                  <button
                    onClick={() => { setPlaybackSpeed('normal'); stopActiveAudio(); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${playbackSpeed === 'normal' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 bg-transparent'}`}
                  >
                    1.0x Normal
                  </button>
                  <button
                    onClick={() => { setPlaybackSpeed('slow'); stopActiveAudio(); }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${playbackSpeed === 'slow' ? 'bg-white text-orange-600 shadow-sm' : 'text-neutral-500 bg-transparent'}`}
                  >
                    0.65x Slow
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100">
                <button
                  onClick={() => {
                    stopActiveAudio();
                    setBuilderStep(2);
                  }}
                  className="w-full sm:w-auto px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <span>Proceed to Build (开始组合拼句) →</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Build the Question */}
          {builderStep === 2 && (
            <motion.div
              key="builder-step-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-left animate-in fade-in duration-250"
            >
              <div className="flex items-center justify-between select-none">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                  Assembling Card
                </span>
                
                <button
                  onClick={playActiveQuestion}
                  className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-neutral-200"
                >
                  {audioState === 'playing' ? <Pause className="w-3.5 h-3.5 fill-current animate-pulse" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>Listen Again</span>
                </button>
              </div>

              {/* ASSEMBLED TRAY */}
              <div className="p-5 min-h-[96px] bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-wrap gap-2 items-center justify-start">
                {selectedIndices.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-semibold italic w-full text-center py-2">
                    Click the word tiles below in sequence...
                  </p>
                ) : (
                  selectedIndices.map((origIdx, sIdx) => {
                    const word = shuffledPool[origIdx];
                    return (
                      <button
                        key={`selected-${sIdx}-${origIdx}`}
                        onClick={() => {
                          setSelectedIndices(selectedIndices.filter((_, idx) => idx !== sIdx));
                          setCheckState('idle');
                        }}
                        className="px-3.5 py-1.5 bg-blue-50 text-blue-900 font-bold text-xs rounded-xl border border-blue-200 cursor-pointer shadow-sm select-none active:scale-95 transition-all"
                      >
                        {word}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Word Tiles pool */}
              <div className="space-y-2 select-none">
                <span className="text-[9px] font-black text-neutral-400 block uppercase tracking-wider">Word tiles pool (includes distractors / 干扰词已混入)</span>
                <div className="flex flex-wrap gap-2 p-3.5 bg-white border border-neutral-200 rounded-2xl min-h-[90px] justify-start shadow-inner animate-in fade-in duration-200">
                  {shuffledPool.map((word, origIdx) => {
                    const isPlaced = selectedIndices.includes(origIdx);
                    return (
                      <button
                        key={`pool-${origIdx}`}
                        onClick={() => {
                          if (!isPlaced) {
                            setSelectedIndices([...selectedIndices, origIdx]);
                            setCheckState('idle');
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border select-none transition-all cursor-pointer ${
                          isPlaced
                            ? 'bg-neutral-100 text-neutral-350 border-neutral-200 opacity-20 pointer-events-none'
                            : 'bg-white text-neutral-850 hover:border-neutral-400 hover:bg-neutral-50 active:scale-95 shadow-sm'
                        }`}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Check Evaluator */}
              {checkState !== 'idle' && (
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in zoom-in-95 duration-150 ${
                  checkState === 'correct' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black ${
                      checkState === 'correct' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'
                    }`}>
                      {checkState === 'correct' ? '✓' : '✗'}
                    </span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">{checkState === 'correct' ? 'Correct Pattern!' : 'Try Again!'}</h4>
                      <p className="text-[11px] opacity-90">{checkState === 'correct' ? 'Perfect logic sequence. Go check details now!' : 'Listen again and fix tiles sequence!'}</p>
                    </div>
                  </div>
                  {checkState === 'correct' && (
                    <button onClick={() => { stopActiveAudio(); setBuilderStep(3); }} className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer shadow transition-all active:scale-95">Details →</button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 select-none font-sans">
                <button
                  onClick={() => {
                    stopActiveAudio();
                    setBuilderStep(1);
                  }}
                  className="px-3 py-1.5 text-neutral-500 hover:text-neutral-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  ← Back (返回裸听)
                </button>

                {checkState !== 'correct' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setSelectedIndices([]); setCheckState('idle'); }}
                      className="px-3 py-1.5 border border-neutral-200 hover:bg-neutral-55 text-neutral-500 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      Reset Board
                    </button>
                    <button
                      onClick={() => {
                        const cleanWords = currentSubQuestion.replace(/[?!.,]/g, '').split(/\s+/).filter(Boolean).map(w => w.toLowerCase());
                        const chosenWords = selectedIndices.map(idx => shuffledPool[idx]).map(w => w.toLowerCase());
                        if (cleanWords.length !== chosenWords.length) { setCheckState('try_again'); return; }
                        const isCorrect = cleanWords.every((word, i) => word === chosenWords[i]);
                        setCheckState(isCorrect ? 'correct' : 'try_again');
                      }}
                      disabled={selectedIndices.length === 0}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
                        selectedIndices.length === 0 ? 'bg-neutral-200 text-neutral-400' : 'bg-neutral-900 hover:bg-neutral-850 text-white'
                      }`}
                    >
                      Check Sequence
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Check & Notice */}
          {builderStep === 3 && (
            <motion.div
              key="builder-step-3"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6 text-left animate-in fade-in duration-250"
            >
              <div className="bg-emerald-50/15 p-5 sm:p-6 rounded-2xl border border-emerald-250/60 space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Correct Query Original</span>
                  <h3 className="text-base font-extrabold text-neutral-950 leading-relaxed pr-8">
                    {currentSubQuestion}
                  </h3>
                </div>

                {/* Translation block */}
                {(() => {
                  let meaning = "";
                  if (activeTab === 'expansion') {
                    meaning = currentExpansionQuestion?.chineseMeaning || "";
                  } else if (activeTab === 'topic' && currentTopicQuestion) {
                    const meta = listeningMetadata.find(m => m.id === currentTopicQuestion.id);
                    meaning = meta?.chineseMeaning || "";
                  }
                  if (meaning) {
                    return (
                      <div className="pt-3 border-t border-neutral-200/50">
                        <span className="text-[9px] font-bold text-neutral-450 block uppercase tracking-wider">Chinese translation</span>
                        <p className="text-xs font-bold text-neutral-700 mt-1">{meaning}</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Question Signal */}
              {(() => {
                const { signal, chinese } = getQuestionSignalAndDistractors(currentSubQuestion);
                return (
                  <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Core Question Pattern Analyzed
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                        <span className="text-[8px] font-bold text-neutral-400 block uppercase">Signal Keyword</span>
                        <p className="text-xs font-black text-blue-900 font-mono mt-0.5">{signal || "Clause template"}</p>
                      </div>
                      <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                        <span className="text-[8px] font-bold text-neutral-400 block uppercase">Functional Target</span>
                        <p className="text-xs font-bold text-neutral-700 mt-0.5">{chinese || "考官提问方向"}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Need Practice Marker Trigger */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-neutral-100 pt-5">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleToggleMark}
                    className={`px-4 py-2 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                      isActiveMarked ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <span>★</span>
                    <span>{isActiveMarked ? 'In Practice' : 'Mark Need Practice'}</span>
                  </button>

                  {isActiveMarked && (
                    <button
                      onClick={handleToggleMark}
                      className="px-3.5 py-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Mastered</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end select-none font-sans">
                  <button
                    onClick={() => {
                      setBuilderStep(1);
                      setSelectedIndices([]);
                      setCheckState('idle');
                      stopActiveAudio();
                    }}
                    className="px-3 py-2 text-neutral-500 hover:text-neutral-800 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 text-neutral-400 inline mr-1" /> Re-drill
                  </button>

                  {subQuestionIdx < subQuestions.length - 1 ? (
                    <button
                      onClick={() => {
                        setSubQuestionIdx(subQuestionIdx + 1);
                        setBuilderStep(1);
                        setSelectedIndices([]);
                        setCheckState('idle');
                        stopActiveAudio();
                      }}
                      className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow"
                    >
                      Next Clause →
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (activeTab === 'topic') {
                          handleTopicNext();
                        } else {
                          handleExpansionNext();
                        }
                      }}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      Next Phrase →
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-1 animate-in fade-in duration-300 font-sans leading-normal">
      
      {/* 1. TOP HEADER BAR - Clean, premium, compact */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-100 pb-4 select-none">
        <div className="flex items-center gap-3">
          {onBackToLobby && (
            <button
              onClick={() => { stopActiveAudio(); onBackToLobby(); }}
              className="p-2 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 text-neutral-600 rounded-xl transition-all shadow-sm cursor-pointer"
              title="Return to Practice Lobby"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <span className="text-[9px] font-bold text-neutral-400 font-sans tracking-wide uppercase">
              B1 Practice Portal
            </span>
            <h2 className="text-lg font-black text-neutral-900 font-display flex items-center gap-1.5 leading-none">
              <Volume2 className="w-4.5 h-4.5 text-blue-600" />
              Examiner Audio Studio
            </h2>
          </div>
        </div>

        {/* Mode Switcher Pill */}
        <div className="flex p-0.5 bg-neutral-105 border border-neutral-200 rounded-xl w-full sm:w-auto shadow-inner">
          <button
            onClick={() => { stopActiveAudio(); setActiveTab('topic'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'topic'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 bg-transparent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Topic Drill
          </button>
          <button
            onClick={() => { stopActiveAudio(); setActiveTab('expansion'); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'expansion'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 bg-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Expansion Bank
          </button>
        </div>
      </div>

      {/* 2. BODY LAYOUT STAGE */}
      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* CO-PANE: LEFT SIDEBAR DRAWER (SECONDARY LAYER) */}
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -16, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 'auto' }}
                exit={{ opacity: 0, x: -16, width: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-full lg:col-span-4 bg-white rounded-2xl border border-neutral-200 p-5 space-y-4 shadow-sm select-none"
              >
                {/* Header of Sidebar */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <span className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                    <List className="w-4 h-4 text-neutral-400" />
                    Topics & Lists
                  </span>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 bg-neutral-50 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                    title="Hide List"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dropdown selectors */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest block mb-1">
                    {activeTab === 'topic' ? '🎯 Selected Drill (当前训练范围)' : '🔮 Category Focus (当前主题维度)'}
                  </label>
                  
                  {activeTab === 'topic' ? (
                    /* TOPICS SELECTION DROPDOWN */
                    <div className="relative">
                      <button
                        onClick={() => setIsTopicDropdownOpen(!isTopicDropdownOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-3.5 bg-gradient-to-r from-blue-50/60 to-blue-100/30 border-2 border-blue-500 rounded-xl text-xs font-black text-blue-950 hover:from-blue-50/80 hover:to-blue-100/50 transition-all cursor-pointer shadow-md shadow-blue-100/40 ring-4 ring-blue-500/10 active:scale-98"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="truncate">{selectedTopic}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-blue-500 ml-1 shrink-0" />
                      </button>

                      <AnimatePresence>
                        {isTopicDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsTopicDropdownOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute left-0 right-0 mt-1 mb-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 max-h-[300px] overflow-y-auto p-2 space-y-2"
                            >
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest pl-2">Part 1 Focus (个人自选)</p>
                                {part1Topics.map(t => (
                                  <button
                                    key={t}
                                    onClick={() => { setSelectedTopic(t); setIsTopicDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                      selectedTopic === t ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-neutral-50 text-neutral-600'
                                    }`}
                                  >
                                    {t}
                                    {selectedTopic === t && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                  </button>
                                ))}
                              </div>
                              
                              <div className="h-px bg-neutral-100 my-1" />

                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest pl-2">Part 2 Range (六大延伸)</p>
                                {part2Topics.map(t => (
                                  <button
                                    key={t}
                                    onClick={() => { setSelectedTopic(t); setIsTopicDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                      selectedTopic === t ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-neutral-50 text-neutral-600'
                                    }`}
                                  >
                                    {t}
                                    {selectedTopic === t && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    /* CATEGORIES EXPANSION DROPDOWN */
                    <div className="relative">
                      <button
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-3.5 bg-gradient-to-r from-blue-50/60 to-blue-100/30 border-2 border-blue-500 rounded-xl text-xs font-black text-blue-950 hover:from-blue-50/80 hover:to-blue-100/50 transition-all cursor-pointer shadow-md shadow-blue-100/40 ring-4 ring-blue-500/10 active:scale-98"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />
                          <div className="flex flex-col text-left min-w-0">
                            <span className="truncate text-xs font-extrabold text-blue-950">{selectedCategory === 'All' ? 'All categories' : selectedCategory}</span>
                            <span className="text-[9px] text-blue-600 font-black truncate leading-none mt-1">
                              {selectedCategory === 'All' ? '全部家庭主题维度' : (CATEGORY_TRANSLATIONS[selectedCategory] || '')}
                            </span>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-blue-500 ml-1 shrink-0 animate-none" />
                      </button>

                      <AnimatePresence>
                        {isCategoryDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsCategoryDropdownOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 max-h-[280px] overflow-y-auto p-1.5 space-y-1"
                            >
                              <button
                                onClick={() => { setSelectedCategory('All'); setIsCategoryDropdownOpen(false); }}
                                className={`w-full text-left p-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                  selectedCategory === 'All' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-neutral-50 text-neutral-600'
                                }`}
                              >
                                <div className="flex flex-col text-left">
                                  <span>All family items</span>
                                  <span className="text-[9px] text-neutral-400">全部类别</span>
                                </div>
                                {selectedCategory === 'All' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                              </button>
                              
                              <div className="h-px bg-neutral-100 my-1" />

                              {categoriesList.map(category => (
                                <button
                                  key={category}
                                  onClick={() => { setSelectedCategory(category); setIsCategoryDropdownOpen(false); }}
                                  className={`w-full text-left p-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                    selectedCategory === category ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-neutral-50 text-neutral-600'
                                  }`}
                                >
                                  <div className="flex flex-col text-left min-w-0">
                                    <span className="truncate">{category}</span>
                                    <span className="text-[9px] text-neutral-450 truncate mt-0.5">{CATEGORY_TRANSLATIONS[category] || ''}</span>
                                  </div>
                                  {selectedCategory === category && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Question list (no target preview answers) */}
                <div className="space-y-2 pr-0.5 select-none">
                  {/* List Filter Segmenter */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100/80 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-500">
                    <button
                      onClick={() => setShowMarkedOnly(false)}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        !showMarkedOnly
                          ? 'bg-white text-neutral-900 shadow-sm font-black'
                          : 'hover:text-neutral-700 bg-transparent'
                      }`}
                    >
                      All Questions
                    </button>
                    <button
                      onClick={() => setShowMarkedOnly(true)}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        showMarkedOnly
                          ? 'bg-amber-500 text-white shadow-sm font-black'
                          : 'hover:text-amber-600 bg-transparent'
                      }`}
                    >
                      <span className={showMarkedOnly ? "text-white" : "text-amber-500 font-extrabold"}>★</span>
                      Need Practice ({activeTab === 'topic' ? rawTopicQuestions.filter(q => markedQuestionIds.has(q.id)).length : rawExpansionQuestions.filter(q => markedQuestionIds.has(q.id)).length})
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                      {showMarkedOnly ? 'Need Practice List' : 'Practice scope'}
                    </label>
                    <span className="text-[9px] font-mono font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {(activeTab === 'topic' ? filteredTopicQuestions : filteredExpansionQuestions).length} tasks
                    </span>
                  </div>

                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {activeTab === 'topic' ? (
                      filteredTopicQuestions.length > 0 ? (
                        filteredTopicQuestions.map((q, idx) => {
                          const isSelected = topicQuestionIdx === idx;
                          const isItemMarked = markedQuestionIds.has(q.id);
                          return (
                            <button
                              key={q.id || idx}
                              onClick={() => handleSelectQuestion(idx)}
                              className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border flex items-center justify-between gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-extrabold'
                                  : 'bg-white text-neutral-700 border-neutral-100 hover:bg-neutral-50 hover:text-neutral-900 font-semibold'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 flex items-center justify-center ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-neutral-150 text-neutral-500'
                                }`}>
                                  Q{(idx + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="truncate select-none font-bold text-[11px] leading-none shrink-0 text-neutral-400">
                                  Phrase {(idx + 1).toString().padStart(2, '0')}
                                </span>
                              </div>
                              {isItemMarked && (
                                <span className="text-amber-500 font-black shrink-0 text-xs text-right">★</span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-center py-6 text-xs text-neutral-400 italic">No drills available.</p>
                      )
                    ) : (
                      filteredExpansionQuestions.length > 0 ? (
                        filteredExpansionQuestions.map((q, idx) => {
                          const isSelected = expansionQuestionIdx === idx;
                          const isItemMarked = markedQuestionIds.has(q.id);
                          return (
                            <button
                              key={q.id || idx}
                              onClick={() => handleSelectQuestion(idx)}
                              className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border flex items-center justify-between gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-extrabold'
                                  : 'bg-white text-neutral-700 border-neutral-100 hover:bg-neutral-50 hover:text-neutral-900 font-semibold'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 flex items-center justify-center ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-neutral-150 text-neutral-500'
                                }`}>
                                  Q{(idx + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="truncate select-none font-bold text-[11px] leading-none shrink-0 text-neutral-400">
                                  Phrase {(idx + 1).toString().padStart(2, '0')}
                                </span>
                              </div>
                              {isItemMarked && (
                                <span className="text-amber-500 font-black shrink-0 text-xs text-right">★</span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-center py-6 text-xs text-neutral-400 italic">No drills available.</p>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SECOND COLUMN: ZEN PLAYER AREA (PRIMARY LAYER - NOVA EXAMINER STUDIO) */}
          <div className={`transition-all duration-300 ${isSidebarOpen ? 'lg:col-span-8' : 'lg:col-span-12 max-w-2xl mx-auto w-full'} space-y-4 flex flex-col`}>
            
            {/* STUDIO HEADER / BREADCRUMB */}
            <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200/60 p-3 rounded-2xl select-none shadow-sm">
              <div className="flex items-center gap-3 px-1 min-w-0">
                {/* Playlist Sidebar Toggle */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg text-neutral-600 hover:text-neutral-950 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all shrink-0 active:scale-95"
                  title={isSidebarOpen ? "Hide playlist" : "Show playlist"}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                    {isSidebarOpen ? "Hide list" : "Show list"}
                  </span>
                </button>

                <div className="min-w-0 flex items-center gap-2">
                  <div className="bg-neutral-900 text-white font-mono text-[11px] font-black px-2 py-0.5 rounded-md shrink-0">
                    {activeTab === 'topic' ? (
                      `Q${(topicQuestionIdx + 1).toString().padStart(2, '0')}`
                    ) : (
                      `Q${(expansionQuestionIdx + 1).toString().padStart(2, '0')}`
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[8px] font-bold text-neutral-400 block tracking-widest uppercase leading-none">Topic</span>
                    <p className="text-xs font-bold text-neutral-800 truncate leading-snug mt-0.5">
                      {activeTab === 'topic' ? selectedTopic : (selectedCategory === 'All' ? 'All family practices' : (CATEGORY_TRANSLATIONS[selectedCategory] || selectedCategory))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Counts Badge & Inline Step Indicator */}
              <div className="shrink-0 flex items-center gap-1.5 bg-white border border-neutral-200 px-2.5 py-1.5 rounded-xl shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="font-mono text-[10px] font-black text-neutral-600 tracking-wider">
                  Step {trainingStep} / 3: {trainingStep === 1 ? 'Blind Listen' : trainingStep === 2 ? 'Build Question' : 'Check Analysis'}
                </span>
              </div>
            </div>

            {/* MAIN STUDIO DECK - Interactive sound-room layout */}
            <div 
              ref={playerCardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-10 space-y-8 relative overflow-hidden flex flex-col shadow-lg transition-shadow duration-350 hover:shadow-xl"
            >
              
              {/* MODE RENDER FLOW */}
              {renderRedesignedPracticeDeck()}
              {true ? null : (
                <>
                  {/* BUILDER CONTENT AREAS */}
                  <div className="animate-in fade-in duration-300">
                    <AnimatePresence mode="wait">
                      
                      {/* --- BUILDER STEP 1: BLIND LISTEN --- */}
                      {builderStep === 1 && (
                        <motion.div
                          key="builder-step-1"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className="space-y-6 text-center"
                        >
                          <div className="border-2 border-dashed border-neutral-200 rounded-3xl p-8 bg-neutral-50/30 flex flex-col items-center justify-center space-y-4">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-105 shadow-sm text-blue-600">
                              <Volume2 className="w-7 h-7" />
                            </div>
                            
                            <div className="space-y-1">
                              <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider">
                                Hear the Examiner Question
                              </h3>
                              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                                Listen to the original British English voice carefully. Try to hold the structure of the question in your auditory memory!
                              </p>
                            </div>

                            {/* Speeds selector & Single Audio trigger */}
                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 select-none w-full max-w-sm">
                              {/* PLAY / PAUSE BUTTON */}
                              <button
                                onClick={playActiveQuestion}
                                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer text-white ${
                                  audioState === 'playing' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-neutral-950 hover:bg-neutral-800'
                                }`}
                              >
                                {audioState === 'playing' ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5 fill-white" />
                                    Pause Question
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-white animate-pulse" />
                                    Play Question
                                  </>
                                )}
                              </button>

                              {/* Rates */}
                              <div className="inline-flex rounded-xl bg-neutral-200 p-1 w-full sm:w-auto">
                                <button
                                  onClick={() => { setPlaybackSpeed('normal'); stopActiveAudio(); }}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wide transition-all ${
                                    playbackSpeed === 'normal'
                                      ? 'bg-white text-neutral-950 shadow'
                                      : 'text-neutral-500 bg-transparent'
                                  }`}
                                >
                                  Normal
                                </button>
                                <button
                                  onClick={() => { setPlaybackSpeed('slow'); stopActiveAudio(); }}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wide transition-all ${
                                    playbackSpeed === 'slow'
                                      ? 'bg-white text-orange-600 shadow'
                                      : 'text-neutral-500 bg-transparent'
                                  }`}
                                >
                                  Slow
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              stopActiveAudio();
                              setBuilderStep(2);
                            }}
                            className="w-full sm:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-transform active:scale-97 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                          >
                            <span>I'm ready, build the question →</span>
                          </button>
                        </motion.div>
                      )}

                      {/* --- BUILDER STEP 2: BUILD THE QUESTION GAME --- */}
                      {builderStep === 2 && (
                        <motion.div
                          key="builder-step-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-6"
                        >
                          <div className="flex items-center justify-between mx-1">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none">
                              Assemble the Query / 组合目标英文问题
                            </span>
                            
                            {/* Re-listen button for premium experience */}
                            <button
                              onClick={playActiveQuestion}
                              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-200"
                            >
                              {audioState === 'playing' ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                  Pause Audio
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  Re-listen Audio
                                </>
                              )}
                            </button>
                          </div>

                          {/* ASSEMBLED TRAY */}
                          <div className="p-5 min-h-[96px] bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-250 flex flex-wrap gap-2.5 items-center justify-start relative">
                            {selectedIndices.length === 0 ? (
                              <p className="text-xs text-neutral-400 font-bold italic w-full text-center py-2">
                                Click the word tiles below in sequence to assemble...
                              </p>
                            ) : (
                              selectedIndices.map((origIdx, sIdx) => {
                                const word = shuffledPool[origIdx];
                                return (
                                  <motion.button
                                    key={`selected-${sIdx}-${origIdx}`}
                                    layoutId={`word-tile-${origIdx}`}
                                    onClick={() => {
                                      // Remove word from assembled tray
                                      setSelectedIndices(selectedIndices.filter((_, idx) => idx !== sIdx));
                                      setCheckState('idle');
                                    }}
                                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-105 text-blue-900 font-bold text-xs rounded-xl border border-blue-200 cursor-pointer shadow-sm flex items-center justify-center select-none active:scale-95 transition-all animate-in zoom-in-95 duration-150"
                                  >
                                    {word}
                                  </motion.button>
                                );
                              })
                            )}
                          </div>

                          {/* AVAILABLE WORDS POOL */}
                          <div className="space-y-2 select-none">
                            <span className="text-[9px] font-black text-neutral-400 block uppercase tracking-widest ml-1">
                              Word tiles pool / 候选词库 (含干扰词)
                            </span>
                            
                            <div className="flex flex-wrap gap-2.5 p-4 bg-white border border-neutral-150 rounded-2xl shadow-inner min-h-[90px] justify-center sm:justify-start">
                              {shuffledPool.map((word, origIdx) => {
                                const isPlaced = selectedIndices.includes(origIdx);
                                return (
                                  <button
                                    key={`pool-${origIdx}`}
                                    onClick={() => {
                                      if (!isPlaced) {
                                        setSelectedIndices([...selectedIndices, origIdx]);
                                        setCheckState('idle');
                                      }
                                    }}
                                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border select-none transition-all cursor-pointer ${
                                      isPlaced
                                        ? 'bg-neutral-100 text-neutral-350 border-neutral-200 opacity-30 pointer-events-none'
                                        : 'bg-white text-neutral-850 hover:bg-neutral-50 hover:border-neutral-400 active:scale-95 shadow-sm'
                                    }`}
                                  >
                                    {word}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* EVALUATION DIALOG / BANNER */}
                          {checkState !== 'idle' && (
                            <div className={`p-4 rounded-xl border animate-in zoom-in-95 duration-150 flex items-center justify-between gap-3 ${
                              checkState === 'correct'
                                ? 'bg-emerald-50 border-emerald-250 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                            }`}>
                              <div className="flex items-center gap-2.5">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-extrabold ${
                                  checkState === 'correct' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'
                                }`}>
                                  {checkState === 'correct' ? '✓' : '✗'}
                                </span>
                                <div>
                                  <h4 className="text-xs font-black uppercase tracking-wider">
                                    {checkState === 'correct' ? 'Correct Pattern! (句子组合正确)' : 'Try Again! (顺序不对或包含干扰词)'}
                                  </h4>
                                  <p className="text-[11px] opacity-90">
                                    {checkState === 'correct' 
                                      ? 'Excellent grammatical intuition. Let us look at the key question features.' 
                                      : 'Listen to the audio reference again and correct the word sequence!'}
                                  </p>
                                </div>
                              </div>

                              {checkState === 'correct' && (
                                <button
                                  onClick={() => {
                                    stopActiveAudio();
                                    setBuilderStep(3);
                                  }}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow transition-transform active:scale-95 cursor-pointer"
                                >
                                  Proceed to Insights →
                                </button>
                              )}
                            </div>
                          )}

                          {/* ACTION BUTTON CONSOLE */}
                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => {
                                setSelectedIndices([]);
                                setCheckState('idle');
                              }}
                              className="px-4 py-2 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              Reset Board (清空重排)
                            </button>

                            {checkState !== 'correct' && (
                              <button
                                onClick={() => {
                                  // Assembled check algorithm
                                  const cleanWords = currentSubQuestion
                                    .replace(/[?!.,]/g, '')
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .map(w => w.toLowerCase());

                                  const chosenWords = selectedIndices
                                    .map(idx => shuffledPool[idx])
                                    .map(w => w.toLowerCase());

                                  if (cleanWords.length !== chosenWords.length) {
                                    setCheckState('try_again');
                                    return;
                                  }

                                  const isCorrect = cleanWords.every((word, i) => word === chosenWords[i]);
                                  if (isCorrect) {
                                    setCheckState('correct');
                                  } else {
                                    setCheckState('try_again');
                                  }
                                }}
                                disabled={selectedIndices.length === 0}
                                className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm ${
                                  selectedIndices.length === 0
                                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                    : 'bg-neutral-950 hover:bg-neutral-900 text-white active:scale-95'
                                }`}
                              >
                                Check Sequence (验证结果)
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* --- BUILDER STEP 3: CHECK & COGNITIVE NOTICE --- */}
                      {builderStep === 3 && (
                        <motion.div
                          key="builder-step-3"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className="space-y-6 text-left"
                        >
                          <div className="bg-blue-50/20 p-5 sm:p-6 rounded-2xl border border-blue-105 text-left space-y-4 font-sans relative">
                            <div className="absolute top-4 right-4 bg-teal-100/50 text-teal-700 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                              Verified Transcript
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider">
                                Correct English query (标准提问原文)
                              </span>
                              <h3 className="text-base font-extrabold text-neutral-900 leading-relaxed pr-8">
                                {currentSubQuestion}
                              </h3>
                            </div>

                            {/* Chinese Translations block */}
                            {(() => {
                              // Retrieve main Chinese translation
                              let meaning = "";
                              if (activeTab === 'expansion') {
                                meaning = currentExpansionQuestion?.chineseMeaning || "";
                              } else if (activeTab === 'topic' && currentTopicQuestion) {
                                const meta = listeningMetadata.find(m => m.id === currentTopicQuestion.id);
                                meaning = meta?.chineseMeaning || "";
                              }
                              
                              if (meaning) {
                                return (
                                  <div className="pt-3 border-t border-neutral-250/20">
                                    <span className="text-[9px] font-bold text-neutral-450 block uppercase tracking-wider">
                                      Chinese Translation (中文对照意图)
                                    </span>
                                    <p className="text-xs font-bold text-neutral-700 mt-1 leading-relaxed">
                                      {meaning}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* QUESTION SIGNAL / PATTERN REPORT */}
                          {(() => {
                            const { signal, chinese } = getQuestionSignalAndDistractors(currentSubQuestion);
                            return (
                              <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/80 space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5 pl-0.5">
                                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                  Core Question Pattern Analyzed / 核心常考功能提问词
                                </span>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  <div className="p-3 bg-white border border-neutral-150 rounded-xl">
                                    <span className="text-[8px] font-black text-neutral-400 block uppercase">Functional Keyword (核心词组)</span>
                                    <p className="text-xs font-black text-blue-900 font-mono mt-0.5">{signal || "Clause template"}</p>
                                  </div>
                                  <div className="p-3 bg-white border border-neutral-150 rounded-xl">
                                    <span className="text-[8px] font-black text-neutral-400 block uppercase">Grammar Target (提问方向)</span>
                                    <p className="text-xs font-bold text-neutral-700 mt-0.5">{chinese || "考官日常习惯/询问看法"}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* ACTION BUTTON CONSOLE AT END OF BUILD */}
                          <div className="flex flex-col sm:flex-row items-center gap-3 justify-end pt-2 select-none">
                            <button
                              onClick={() => {
                                setBuilderStep(1);
                                setSelectedIndices([]);
                                setCheckState('idle');
                                stopActiveAudio();
                              }}
                              className="w-full sm:w-auto px-5 py-2.5 bg-neutral-100 hover:bg-neutral-205 text-neutral-600 hover:text-neutral-900 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Re-drill this clause (重构本变体)
                            </button>

                            {/* Ultimate Progress jump buttons */}
                            {subQuestionIdx < subQuestions.length - 1 ? (
                              <button
                                onClick={() => {
                                  setSubQuestionIdx(subQuestionIdx + 1);
                                  setBuilderStep(1);
                                  setSelectedIndices([]);
                                  setCheckState('idle');
                                  stopActiveAudio();
                                }}
                                className="w-full sm:w-auto px-6 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow"
                              >
                                Drill Next Pattern (下一个变体) →
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  // Next original drill!
                                  if (activeTab === 'topic') {
                                    handleTopicNext();
                                  } else {
                                    handleExpansionNext();
                                  }
                                }}
                                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow"
                              >
                                Next Phrase Challenge (进入下一题型) →
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* ACTION STATS FOOTER: MARK NEED PRACTICE CONTROLS */}
              {false && currentQuestion && (
                <div className="border-t border-neutral-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
                  <div className="text-left w-full sm:w-auto">
                    <span className="text-[9px] font-black text-neutral-400 uppercase block tracking-wider leading-none">
                      PRACTICE STATE / 口语和听感熟练度标记
                    </span>
                    <p className="text-xs text-neutral-500 mt-1">
                      {isActiveMarked 
                        ? "Currently in your Practice Stack (已加入重点疑难库)" 
                        : "Mastered! Removed from Practice stack (流畅裸听无盲区)"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    {/* Mark Need Practice Block */}
                    <button
                      onClick={handleToggleMark}
                      className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border ${
                        isActiveMarked
                          ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:text-neutral-800 hover:bg-neutral-50'
                      }`}
                      title="Add or remove from difficult sets"
                    >
                      <span className="text-sm">★</span>
                      <span>{isActiveMarked ? 'In Practice' : 'Mark Need Practice'}</span>
                    </button>

                    {/* Mastered check button */}
                    {isActiveMarked && (
                      <button
                        onClick={handleToggleMark}
                        className="px-4 py-3 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-700 hover:text-teal-800 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        title="Mark as MASTERED and remove from practice requirements"
                      >
                        <Check className="w-3.5 h-3.5 text-teal-600 stroke-[3]" />
                        <span>Mastered</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation Controls group */}
              <div className="flex items-center justify-between border-t border-neutral-100 pt-6 select-none gap-2">
                <button
                  onClick={activeTab === 'topic' ? handleTopicPrev : handleExpansionPrev}
                  className="px-4 py-2.5 bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 hover:text-neutral-800 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Previous Phrase
                </button>

                <button
                  onClick={activeTab === 'topic' ? handleTopicRandom : handleExpansionRandom}
                  className="p-2.5 bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-400 hover:text-neutral-600 rounded-xl shadow-sm cursor-pointer transition-colors active:rotate-12"
                  title="Random phrase"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={activeTab === 'topic' ? handleTopicNext : handleExpansionNext}
                  className="px-4 py-2.5 bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 hover:text-neutral-800 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                >
                  Next Phrase <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

            {/* TERTIARY LAYER: USER HELP ACCORDION */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setIsHelpOpen(!isHelpOpen)}
                className="w-full text-left p-4 hover:bg-neutral-50 flex items-center justify-between text-neutral-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                  <span className="text-xs font-bold leading-tight">How to practice listening tasks? (裸听模块用法指引)</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-250 ${isHelpOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isHelpOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-neutral-100 overflow-hidden bg-neutral-50/40 text-left"
                  >
                    <div className="p-4 space-y-2 text-xs text-neutral-500 font-sans leading-relaxed">
                      <p className="font-bold text-neutral-700">Recommended Steps (自学裸听推荐步骤):</p>
                      <ol className="list-decimal pl-4 space-y-1.5 mt-1 leading-normal">
                        <li><strong className="text-neutral-700">Browse Group:</strong> Click <strong className="text-neutral-700">Show List</strong> on the left panel to browse question groups. Hide it afterwards to exclude reading support.</li>
                        <li><strong className="text-neutral-700">Focus on sounds:</strong> Click <strong className="text-neutral-700">Play Audio</strong>. Close your eyes, listen carefully, and write down key phrases on scratch paper.</li>
                        <li><strong className="text-neutral-700">Adjust playback speeds:</strong> Use <strong className="text-neutral-700">0.65x Slow mode</strong> to parse linking sounds, flap t's, or unfamiliar phonemic variations.</li>
                        <li><strong className="text-neutral-700">Enable SpeakLoop Mode:</strong> Let the phrase loop continuously to achieve seamless audio absorption and native shadowed voice.</li>
                        <li><strong className="text-neutral-700">Double-check original text:</strong> Click <strong className="text-neutral-700">Reveal Script</strong>. Check if your transcripts match the original phrasings, and draft model responses.</li>
                      </ol>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
