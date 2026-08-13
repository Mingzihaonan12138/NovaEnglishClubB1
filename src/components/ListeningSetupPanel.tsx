import React, { useState, useEffect } from 'react';
import { 
  Save, AlertCircle, Sparkles, Volume2, HelpCircle, 
  CheckCircle2, Edit2, Play, Info, ListFilter, BookOpen
} from 'lucide-react';
import { QuestionAnswer, TRINITY_B1_TOPICS } from '../constants';
import { ListeningMetadata } from '../services/firebaseService';

interface ListeningSetupProps {
  displayQuestions: QuestionAnswer[];
  listeningMetadata: ListeningMetadata[];
  saveListeningMetadata: (metadata: ListeningMetadata) => Promise<void>;
}

const typeOptions = [
  { value: 'preference', label: 'Preference (喜好选择: do you prefer, favourite, like best)' },
  { value: 'frequency', label: 'Frequency (频率频次: how often, how many times)' },
  { value: 'past experience', label: 'Past Experience (过去经历: what did you, last year)' },
  { value: 'reason', label: 'Reason / Why (原因解释: why, reasons, what makes you)' },
  { value: 'description', label: 'Description (细节描述: describe, tell me about, what is it like)' },
  { value: 'other', label: 'Other / Info (细节获取: what, where, who, how)' }
];

export default function ListeningSetupPanel({
  displayQuestions,
  listeningMetadata,
  saveListeningMetadata
}: ListeningSetupProps) {
  const [selectedTopic, setSelectedTopic] = useState<string>(TRINITY_B1_TOPICS[0]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionAnswer | null>(null);

  // Form states
  const [chineseMeaning, setChineseMeaning] = useState('');
  const [keywords, setKeywords] = useState('');
  const [questionType, setQuestionType] = useState('description');
  const [normalAudioUrl, setNormalAudioUrl] = useState('');
  const [slowAudioUrl, setSlowAudioUrl] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const filteredQuestions = displayQuestions.filter(q => q.topic === selectedTopic);

  // Sync form states when selection changes
  useEffect(() => {
    if (!selectedQuestion) return;
    
    const meta = listeningMetadata.find(m => m.id === selectedQuestion.id);
    if (meta) {
      setChineseMeaning(meta.chineseMeaning || '');
      setKeywords(meta.keywords || '');
      setQuestionType(meta.questionType || 'description');
      setNormalAudioUrl(meta.normalAudioUrl || '');
      setSlowAudioUrl(meta.slowAudioUrl || '');
    } else {
      // Prefill logical fallback recommendations
      setChineseMeaning('');
      setKeywords('');
      setQuestionType('description');
      setNormalAudioUrl('');
      setSlowAudioUrl('');
    }
    setSaveSuccess(false);
  }, [selectedQuestion, listeningMetadata]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuestion) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await saveListeningMetadata({
        id: selectedQuestion.id,
        chineseMeaning: chineseMeaning.trim(),
        keywords: keywords.trim(),
        questionType,
        normalAudioUrl: normalAudioUrl.trim(),
        slowAudioUrl: slowAudioUrl.trim()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to save. Please confirm Firestore rules permission.");
    } finally {
      setIsSaving(false);
    }
  };

  // Quick stat helpers
  const getTopicProgress = (topic: string) => {
    const qs = displayQuestions.filter(q => q.topic === topic);
    const configuredCount = qs.filter(q => listeningMetadata.some(m => m.id === q.id)).length;
    return { configured: configuredCount, total: qs.length };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
      {/* 1. LEFT SIDEBAR: TOPICS & COUNTS */}
      <div className="lg:col-span-3 space-y-6 select-none">
        <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-1.5 px-1">
          <BookOpen className="w-3.5 h-3.5 text-neutral-400" /> Topics Progress
        </h4>

        <div className="space-y-1 bg-neutral-50 p-2.5 rounded-[1.5rem] border border-neutral-100">
          {TRINITY_B1_TOPICS.map(topic => {
            const stats = getTopicProgress(topic);
            const isSelected = selectedTopic === topic;
            return (
              <button
                key={topic}
                onClick={() => { setSelectedTopic(topic); setSelectedQuestion(null); }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  isSelected 
                    ? 'bg-neutral-950 text-white shadow-sm' 
                    : 'text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-950'
                }`}
              >
                <span className="truncate mr-2">{topic}</span>
                <span className={`text-[9px] font-mono shrink-0 px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/10 text-white' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {stats.configured}/{stats.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MIDDLE COLUMN: QUESTIONS IN TOPIC */}
      <div className="lg:col-span-4 space-y-4 select-none border-r border-neutral-100 pr-0 lg:pr-8">
        <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-1 px-1">
          <ListFilter className="w-3.5 h-3.5 text-neutral-400" /> Topic Questions
        </h4>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
          {filteredQuestions.map((q, index) => {
            const isConfigured = listeningMetadata.some(m => m.id === q.id);
            const isSelected = selectedQuestion?.id === q.id;

            return (
              <button
                key={q.id}
                onClick={() => setSelectedQuestion(q)}
                className={`w-full text-left p-4 rounded-2xl border text-xs leading-relaxed transition-all flex flex-col gap-2 relative ${
                  isSelected 
                    ? 'bg-neutral-950 border-neutral-950 text-white ring-2 ring-neutral-950 shadow-sm' 
                    : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`font-mono text-[9px] ${isSelected ? 'text-neutral-400' : 'text-neutral-300'}`}>
                    Q{index + 1}. {q.id}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    isConfigured 
                      ? 'bg-green-100 text-green-700' 
                      : isSelected ? 'bg-white/10 text-neutral-300' : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    {isConfigured ? 'Ready' : 'Not Set'}
                  </span>
                </div>
                <p className="font-medium line-clamp-2">{q.question}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. RIGHT COLUMN: DETAILS SETUP FORM */}
      <div className="lg:col-span-5 space-y-6">
        {selectedQuestion ? (
          <form onSubmit={handleSave} className="bg-neutral-50/50 p-6 md:p-8 rounded-[2rem] border border-neutral-100/90 shadow-sm space-y-6">
            <div className="border-b border-neutral-100 pb-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Selected Question (英文原题)</span>
              <h3 className="text-sm font-bold text-neutral-950 leading-relaxed mt-1">{selectedQuestion.question}</h3>
              <p className="text-[10px] font-mono text-neutral-400 mt-1">Suggested answer: <span className="italic">"{selectedQuestion.suggestedAnswer}"</span></p>
            </div>

            {/* A. Chinese Translation */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                Chinese Translation (对应中文意思 / 用于听完选择)
              </label>
              <textarea
                value={chineseMeaning}
                onChange={e => setChineseMeaning(e.target.value)}
                placeholder="例如：你能告诉我更多关于你女儿的信息吗？"
                required
                rows={2}
                className="w-full text-xs p-3 border border-neutral-200 rounded-xl bg-white shadow-inner focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              />
            </div>

            {/* B. Keywords */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Core Keywords (核心关键词用逗号隔开)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="例如：tell me, daughter, information"
                required
                className="w-full text-xs p-3 border border-neutral-200 rounded-xl bg-white focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              />
            </div>

            {/* C. Question Type */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Listening Objective / Type (句型提问目的)
              </label>
              <select
                value={questionType}
                onChange={e => setQuestionType(e.target.value)}
                className="w-full text-xs p-3 border border-neutral-200 rounded-xl bg-white focus:ring-1 focus:ring-neutral-900 focus:outline-none bg-no-repeat"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* D. Audio overrides */}
            <div className="bg-white p-4 border border-neutral-100 rounded-2xl space-y-4">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" /> Audio URL Overrides (音频地址选填)
              </h5>
              
              <div className="space-y-3 text-[10px]">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-500">Normal Speed URL [Default overrides]</label>
                  <input
                    type="text"
                    value={normalAudioUrl}
                    onChange={e => setNormalAudioUrl(e.target.value)}
                    placeholder="/audio/... (Leave blank to use base default)"
                    className="w-full p-2.5 border border-neutral-100 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-500">Slow Speed URL [Fallback uses synthesizer speed=0.65]</label>
                  <input
                    type="text"
                    value={slowAudioUrl}
                    onChange={e => setSlowAudioUrl(e.target.value)}
                    placeholder="/audio/... (Leave blank to use text-to-speech slow fallback)"
                    className="w-full p-2.5 border border-neutral-100 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* STATUS NOTIFICATION CARDS */}
            {saveSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Configured Successfully! Saved in Firestore database.
              </div>
            )}

            {/* Save trigger */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 bg-neutral-950 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neutral-900 transition-all shadow-md active:scale-95 disabled:bg-neutral-300 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving Config..." : "Save Listening Details"}
            </button>
          </form>
        ) : (
          <div className="bg-neutral-50 rounded-[2rem] border border-neutral-100/80 p-12 text-center text-neutral-300 space-y-3 min-h-[40vh] flex flex-col justify-center items-center select-none">
            <HelpCircle className="w-12 h-12 text-neutral-200" />
            <div>
              <p className="font-black uppercase tracking-widest text-xs text-neutral-400">No Question Selected</p>
              <p className="text-[11px] text-neutral-400 mt-1 max-w-xs leading-relaxed">Please select a question from the middle list scroll to configure custom translation meanings and listening drill options.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
