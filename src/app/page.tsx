'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { WritingMode, AnalysisResult, SentenceAnalysis } from '@/lib/types';
import { analyzeLocally } from '@/lib/heuristics';

const SAMPLE_TEXT = `Everyone thinks training larger models is the only path to better AI accuracy. They are wrong because scaling parameters hits severe memory bottlenecks on edge devices. Instead, we compressed a 7B model down to 1.8GB using 4-bit quantization, maintaining 94.2% benchmark accuracy across 100K images. This cuts deployment latency by 60% and saves $12K monthly in cloud compute costs.`;

const ROLE_TEXT_COLORS = {
  hook: 'text-rose-400 dark:text-rose-400',
  tension: 'text-orange-400 dark:text-orange-400',
  resolution: 'text-amber-300 dark:text-amber-300',
  proof: 'text-purple-400 dark:text-purple-400',
  neutral: 'text-neutral-400 dark:text-neutral-300'
};

const ROLE_HEX_COLORS: Record<string, string> = {
  hook: '#fb7185',
  tension: '#fb923c',
  resolution: '#facc15',
  proof: '#c084fc',
  neutral: '#9ca3af'
};

const ROLE_LABELS = {
  hook: 'Hook',
  tension: 'Tension',
  resolution: 'Resolution',
  proof: 'Proof',
  neutral: 'Narrative'
};

function CadenceLineGraph({
  sentences,
  selectedIndex,
  onSelect
}: {
  sentences: SentenceAnalysis[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  if (sentences.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded">
        Cadence graph will plot sentence rhythm as you type
      </div>
    );
  }

  const wordCounts = sentences.map((s) => s.wordCount);
  const maxWords = Math.max(...wordCounts, 10);
  const minWords = Math.max(0, Math.min(...wordCounts) - 2);
  const range = maxWords - minWords || 1;

  const width = 500;
  const height = 90;
  const paddingX = 35;
  const paddingY = 16;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = sentences.map((s, i) => {
    const x =
      sentences.length === 1
        ? width / 2
        : paddingX + (i / (sentences.length - 1)) * chartWidth;
    const y =
      height - paddingY - ((s.wordCount - minWords) / range) * chartHeight;
    return { x, y, sentence: s, index: i };
  });

  const pathD =
    points.length === 1
      ? ''
      : points.reduce(
          (acc, pt, i) =>
            `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
          ''
        );

  return (
    <div className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          Cadence Rhythm Graph
        </span>
        <span>
          Avg: {Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)}w • 
          Range: {Math.min(...wordCounts)}–{Math.max(...wordCounts)}w
        </span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="currentColor"
            strokeDasharray="2 3"
            className="text-neutral-200 dark:text-neutral-800"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="currentColor"
            strokeDasharray="2 3"
            className="text-neutral-200 dark:text-neutral-800"
          />

          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-neutral-400 dark:text-neutral-600"
            />
          )}

          {points.map((pt) => {
            const roleColor = ROLE_HEX_COLORS[pt.sentence.role] || '#9ca3af';
            const isSelected = selectedIndex === pt.index;
            return (
              <g
                key={pt.index}
                className="cursor-pointer"
                onClick={() => onSelect(pt.index)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? '7' : pt.sentence.isMonotonous ? '6' : '4.5'}
                  fill={roleColor}
                  stroke={isSelected ? '#ffffff' : pt.sentence.isMonotonous ? '#ef4444' : 'transparent'}
                  strokeWidth="2"
                  className="transition-transform hover:scale-125"
                />
                <text
                  x={pt.x}
                  y={pt.y - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-neutral-500 font-mono"
                >
                  {pt.sentence.wordCount}w
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {sentences.some((s) => s.isMonotonous) && (
        <p className="text-[11px] text-amber-500">
          Monotony warning: flat cadence detected on identical sentence lengths.
        </p>
      )}
    </div>
  );
}

export default function Page() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [mode, setMode] = useState<WritingMode>('x');
  const [view, setView] = useState<'draft' | 'story'>('draft');
  const [apiKey, setApiKey] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isAuditing, startAuditing] = useTransition();
  const [auditResult, setAuditResult] = useState<AnalysisResult | null>(null);
  const [auditFeedback, setAuditFeedback] = useState<{ type: 'success' | 'notice' | 'error'; message: string } | null>(null);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Load API key and model from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('copycraft_api_key');
    const savedModel = localStorage.getItem('copycraft_model');
    if (savedKey) {
      setApiKey(savedKey);
      fetchModels(savedKey, savedModel || undefined);
    }
  }, []);

  const fetchModels = async (key: string, preserveModel?: string) => {
    if (!key.trim()) {
      setAvailableModels([]);
      setSelectedModel('');
      return;
    }
    setIsLoadingModels(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        const models: string[] = data.models || [];
        setAvailableModels(models);
        if (models.length > 0) {
          const chosen = (preserveModel && models.includes(preserveModel)) ? preserveModel : models[0];
          setSelectedModel(chosen);
          localStorage.setItem('copycraft_model', chosen);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem('copycraft_api_key', key);
    fetchModels(key);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('copycraft_model', model);
  };

  const localAnalysis = useMemo(() => analyzeLocally(text, mode), [text, mode]);
  const activeAnalysis = auditResult || localAnalysis;

  useEffect(() => {
    if (auditResult && auditResult.charCount !== text.length) {
      setAuditResult(null);
      setAuditFeedback(null);
      setSelectedSentenceIndex(null);
    }
  }, [text, auditResult]);

  const handleAudit = () => {
    if (!text.trim()) return;
    setAuditFeedback(null);
    startAuditing(async () => {
      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            mode,
            apiKey: apiKey.trim() || undefined,
            model: selectedModel || undefined
          })
        });
        if (res.ok) {
          const data = await res.json();
          setAuditResult(data);
          if (data.apiError) {
            setAuditFeedback({ type: 'error', message: data.apiError });
          } else if (data.source && data.source !== 'local') {
            setAuditFeedback({ type: 'success', message: `Audited with ${data.source}` });
          } else {
            setAuditFeedback({ type: 'notice', message: data.apiNotice || 'Local heuristic audit. Add Groq key for deep AI coaching.' });
          }
        } else {
          setAuditFeedback({ type: 'error', message: `Server error ${res.status}` });
        }
      } catch (err: any) {
        setAuditFeedback({ type: 'error', message: err?.message || 'Network error' });
      }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isOverXLimit = mode === 'x' && text.length > 280;
  const keyType = apiKey.startsWith('gsk_') ? 'Groq' : apiKey ? 'Gemini' : null;
  const selectedSentence = selectedSentenceIndex !== null ? activeAnalysis.sentences[selectedSentenceIndex] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-neutral-200 dark:border-neutral-800 text-sm">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">CopyCraft</span>
          <nav className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded">
            {(['x', 'blog', 'pitch'] as WritingMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded text-xs transition ${
                  mode === m
                    ? 'bg-white dark:bg-neutral-800 font-medium shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                {m === 'x' ? 'X Post' : m === 'blog' ? 'Blog' : 'Pitch'}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Model Selector in Header if models loaded */}
          {availableModels.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded font-mono"
            >
              {availableModels.map((m) => (
                <option key={m} value={m} className="bg-white dark:bg-neutral-900">
                  {m}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 underline"
          >
            {keyType ? `${keyType} Key` : 'API Key'}
          </button>
          <button
            onClick={handleAudit}
            disabled={isAuditing || !text.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 disabled:opacity-50"
          >
            {isAuditing ? 'Auditing...' : 'Run Coach Audit'}
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs border border-neutral-200 dark:border-neutral-800 rounded hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </header>

      {/* Groq / Gemini API Key & Model Configuration */}
      {showKeyInput && (
        <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">API Key:</span>
              <input
                type="password"
                placeholder="Paste Groq (gsk_...) or Gemini key"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="w-64 px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded font-mono text-xs"
              />
            </div>

            {isLoadingModels ? (
              <span className="text-neutral-400 italic">Fetching models from provider...</span>
            ) : availableModels.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">Model:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded font-mono text-xs max-w-xs"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <button
            onClick={() => setShowKeyInput(false)}
            className="px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      )}

      {/* Audit Feedback Banner */}
      {auditFeedback && (
        <div
          className={`mt-3 p-2 text-xs rounded border flex items-center justify-between ${
            auditFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : auditFeedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}
        >
          <span>{auditFeedback.message}</span>
          <button
            onClick={() => setAuditFeedback(null)}
            className="opacity-70 hover:opacity-100 ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Split Interface */}
      <main className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 py-4">
        {/* Left Column: Canvas & Cadence Graph */}
        <section className="md:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-1 text-xs text-neutral-500">
            <div className="flex bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded">
              <button
                onClick={() => setView('draft')}
                className={`px-3 py-1 rounded transition text-xs ${
                  view === 'draft'
                    ? 'bg-white dark:bg-neutral-800 font-medium shadow-sm text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Edit Draft
              </button>
              <button
                onClick={() => setView('story')}
                className={`px-3 py-1 rounded transition text-xs flex items-center gap-1.5 ${
                  view === 'story'
                    ? 'bg-white dark:bg-neutral-800 font-medium shadow-sm text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <span>Story Flow</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className={isOverXLimit ? 'text-red-500 font-semibold' : ''}>
                {text.length}{mode === 'x' ? ' / 280' : ' chars'}
              </span>
              <span>{activeAnalysis.wordCount} words</span>
            </div>
          </div>

          {/* Canvas View */}
          {view === 'draft' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write raw draft here..."
              className="w-full p-3.5 border border-neutral-200 dark:border-neutral-800 rounded bg-transparent font-sans text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-neutral-400 min-h-[220px]"
            />
          ) : (
            <div className="space-y-3">
              <div
                className="w-full p-4 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-900/40 text-sm leading-relaxed min-h-[160px]"
              >
                {activeAnalysis.sentences.length === 0 ? (
                  <p className="text-neutral-400">Write text in Edit Draft to view story flow.</p>
                ) : (
                  <p className="inline leading-relaxed">
                    {activeAnalysis.sentences.map((s, idx) => (
                      <span
                        key={s.id || idx}
                        onClick={() => setSelectedSentenceIndex(idx)}
                        className={`${ROLE_TEXT_COLORS[s.role]} ${
                          s.leaks.length > 0 ? 'underline decoration-wavy decoration-red-500' : ''
                        } ${
                          selectedSentenceIndex === idx ? 'bg-white/10 px-1 py-0.5 rounded' : ''
                        } cursor-pointer hover:opacity-80 transition-opacity mr-1.5`}
                        title={`Click to inspect • ${ROLE_LABELS[s.role]} • ${s.wordCount} words`}
                      >
                        {s.text}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {/* Selected Sentence Inspector */}
              {selectedSentence && (
                <div className="p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Sentence {selectedSentenceIndex! + 1} ({ROLE_LABELS[selectedSentence.role]} • {selectedSentence.wordCount}w)
                    </span>
                    <button
                      onClick={() => setSelectedSentenceIndex(null)}
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                    >
                      &times;
                    </button>
                  </div>
                  {selectedSentence.tip ? (
                    <p className="text-neutral-700 dark:text-neutral-300 italic">
                      Coach Tip: {selectedSentence.tip}
                    </p>
                  ) : (
                    <p className="text-neutral-500">
                      {selectedSentence.leaks.length > 0
                        ? `Leaks: ${selectedSentence.leaks.join(', ')}`
                        : 'Sentence structurally sound.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Visual Cadence Line Graph */}
          <CadenceLineGraph
            sentences={activeAnalysis.sentences}
            selectedIndex={selectedSentenceIndex}
            onSelect={(idx) => setSelectedSentenceIndex(idx)}
          />
        </section>

        {/* Right Column: Pre-Publish Checklist & Coach Audit */}
        <section className="md:col-span-5 flex flex-col space-y-6">
          {/* Pre-Publish Checklist */}
          <div>
            <div className="pb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Pre-Publish Checklist
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { key: 'strongHook', label: 'Hook punchiness' },
                { key: 'clearOutcome', label: 'Clear outcome ("So What?")' },
                { key: 'tensionPivot', label: 'Tension / Conflict beat' },
                { key: 'concreteProof', label: 'Concrete proof (Deaf & Mute)' },
                { key: 'conciseWords', label: 'No $10-word copy leaks' },
                { key: 'variedCadence', label: 'Varied sentence cadence' }
              ].map(({ key, label }) => {
                const passed = activeAnalysis.checklist[key as keyof typeof activeAnalysis.checklist];
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${passed ? 'text-emerald-500 font-bold' : 'text-neutral-400'}`}>
                      {passed ? '[x]' : '[ ]'}
                    </span>
                    <span className={passed ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400'}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Socratic Challenges */}
          <div>
            <div className="pb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span>Socratic Challenges</span>
              {auditResult && (
                <span className="text-[10px] text-emerald-500 lowercase font-normal">
                  (ai audit active)
                </span>
              )}
            </div>
            {activeAnalysis.coachingChallenges.length === 0 ? (
              <p className="text-xs text-neutral-500">All checks pass. Ready to ship.</p>
            ) : (
              <ul className="space-y-2">
                {activeAnalysis.coachingChallenges.map((challenge, i) => (
                  <li
                    key={i}
                    className="p-2.5 text-xs rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 bg-neutral-50/50 dark:bg-neutral-900/50"
                  >
                    {challenge}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
