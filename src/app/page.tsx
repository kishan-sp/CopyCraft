'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { WritingMode, AnalysisResult, SentenceAnalysis, SentenceRole } from '@/lib/types';
import { analyzeLocally } from '@/lib/heuristics';

const SAMPLE_TEXT = `Everyone thinks training larger models is the only path to better AI accuracy. They are wrong because scaling parameters hits severe memory bottlenecks on edge devices. Instead, we compressed a 7B model down to 1.8GB using 4-bit quantization, maintaining 94.2% benchmark accuracy across 100K images. This cuts deployment latency by 60% and saves $12K monthly in cloud compute costs.`;

const NARRATIVE_CYCLE_COLORS = [
  { textColor: 'text-rose-400 dark:text-rose-400', hex: '#fb7185' },
  { textColor: 'text-orange-400 dark:text-orange-400', hex: '#fb923c' },
  { textColor: 'text-amber-300 dark:text-amber-300', hex: '#facc15' },
  { textColor: 'text-emerald-400 dark:text-emerald-400', hex: '#34d399' },
  { textColor: 'text-purple-400 dark:text-purple-400', hex: '#c084fc' },
  { textColor: 'text-sky-400 dark:text-sky-400', hex: '#38bdf8' }
];

const ROLE_BASE_COLOR_INDEX: Record<SentenceRole, number> = {
  hook: 0,       // Rose
  tension: 1,    // Orange
  resolution: 2, // Amber
  proof: 4,      // Purple
  neutral: -1
};

const ROLE_LABELS = {
  hook: 'Hook',
  tension: 'Tension',
  resolution: 'Resolution',
  proof: 'Proof',
  neutral: 'Narrative'
};

// Guarantees that every sentence end triggers an immediate color change
function computeSentenceColors(sentences: SentenceAnalysis[]) {
  const result: { textColor: string; hex: string }[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const prevHex = i > 0 ? result[i - 1].hex : null;

    let colorIndex: number;

    if (s.role !== 'neutral' && ROLE_BASE_COLOR_INDEX[s.role] !== undefined) {
      colorIndex = ROLE_BASE_COLOR_INDEX[s.role];
      if (prevHex && NARRATIVE_CYCLE_COLORS[colorIndex].hex === prevHex) {
        colorIndex = (colorIndex + 1) % NARRATIVE_CYCLE_COLORS.length;
      }
    } else {
      colorIndex = i % NARRATIVE_CYCLE_COLORS.length;
      if (prevHex && NARRATIVE_CYCLE_COLORS[colorIndex].hex === prevHex) {
        colorIndex = (colorIndex + 1) % NARRATIVE_CYCLE_COLORS.length;
      }
    }

    result.push(NARRATIVE_CYCLE_COLORS[colorIndex]);
  }

  return result;
}

function CadenceLineGraph({
  sentences,
  sentenceColors,
  selectedIndex,
  onSelect
}: {
  sentences: SentenceAnalysis[];
  sentenceColors: { textColor: string; hex: string }[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  if (sentences.length === 0) {
    return (
      <div className="h-20 flex items-center justify-center font-display uppercase tracking-wider text-xs text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded">
        Cadence graph will plot sentence rhythm as you type
      </div>
    );
  }

  const wordCounts = sentences.map((s) => s.wordCount);
  const maxWords = Math.max(...wordCounts, 10);
  const minWords = Math.max(0, Math.min(...wordCounts) - 2);
  const range = maxWords - minWords || 1;

  const width = 500;
  const height = 85;
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
    <div className="p-3.5 border border-neutral-200 dark:border-neutral-800/80 rounded bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm space-y-2">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span className="font-display uppercase tracking-wider text-sm text-neutral-300">
          Cadence Rhythm
        </span>
        <span className="font-display uppercase tracking-wider text-xs">
          Avg: {Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)}w • Range: {Math.min(...wordCounts)}–{Math.max(...wordCounts)}w
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
            const ptColor = sentenceColors[pt.index]?.hex || '#9ca3af';
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
                  r={isSelected ? '6.5' : pt.sentence.isMonotonous ? '5.5' : '4'}
                  fill={ptColor}
                  stroke={isSelected ? '#ffffff' : pt.sentence.isMonotonous ? '#ef4444' : 'transparent'}
                  strokeWidth="2"
                  className="transition-transform hover:scale-125"
                />
                <text
                  x={pt.x}
                  y={pt.y - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-neutral-400 font-mono"
                >
                  {pt.sentence.wordCount}w
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {sentences.some((s) => s.isMonotonous) && (
        <p className="text-[11px] text-amber-500 font-medium">
          Monotony warning: flat cadence detected across identical sentence lengths.
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
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

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
  
  // Calculate distinct alternating colors so that every sentence end triggers a color change
  const sentenceColors = useMemo(
    () => computeSentenceColors(activeAnalysis.sentences),
    [activeAnalysis.sentences]
  );

  useEffect(() => {
    if (auditResult && auditResult.charCount !== text.length) {
      setAuditResult(null);
      setAuditError(null);
      setSelectedSentenceIndex(null);
    }
  }, [text, auditResult]);

  const handleAudit = () => {
    if (!text.trim()) return;
    setAuditError(null);
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
          if (data.apiError) {
            setAuditError(data.apiError);
          } else {
            setAuditResult(data);
          }
        } else {
          setAuditError(`Audit request failed (${res.status})`);
        }
      } catch (err: any) {
        setAuditError(err?.message || 'Network error during audit');
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
    <div className="min-h-screen bg-grid-subtle">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-6">
            <span className="font-display text-2xl tracking-wider uppercase text-neutral-900 dark:text-neutral-100">
              CopyCraft
            </span>
            <nav className="flex gap-1 bg-neutral-100 dark:bg-neutral-900/80 p-0.5 rounded border border-neutral-200 dark:border-neutral-800">
              {(['x', 'blog', 'pitch'] as WritingMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded font-display text-xs uppercase tracking-wider transition ${
                    mode === m
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {m === 'x' ? 'X Post' : m === 'blog' ? 'Blog' : 'Pitch'}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {availableModels.length > 0 && (
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-transparent rounded font-mono text-neutral-700 dark:text-neutral-300 focus:outline-none"
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
              className="font-display tracking-wider uppercase text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 underline px-2 py-1"
            >
              {keyType ? `${keyType} Key` : 'API Key'}
            </button>
            <button
              onClick={handleAudit}
              disabled={isAuditing || !text.trim()}
              className="px-4 py-1.5 font-display text-xs tracking-wider uppercase rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition disabled:opacity-50"
            >
              {isAuditing ? 'Auditing...' : 'Run Coach Audit'}
            </button>
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 font-display text-xs tracking-wider uppercase border border-neutral-300 dark:border-neutral-800 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </header>

        {/* API Key & Dynamic Models Drawer */}
        {showKeyInput && (
          <div className="py-3 px-3.5 mt-2 border border-neutral-200 dark:border-neutral-800 rounded flex flex-wrap items-center justify-between gap-3 text-xs bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="flex items-center gap-2">
                <span className="font-display uppercase tracking-wider text-neutral-500">API Key:</span>
                <input
                  type="password"
                  placeholder="Paste Groq (gsk_...) or Gemini key"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="w-64 px-2.5 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded font-mono text-xs focus:outline-none"
                />
              </div>

              {isLoadingModels ? (
                <span className="text-neutral-400 font-mono text-xs">Fetching models...</span>
              ) : availableModels.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="font-display uppercase tracking-wider text-neutral-500">Model:</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded font-mono text-xs max-w-xs focus:outline-none"
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
              className="px-2.5 py-1 font-display uppercase tracking-wider rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
            >
              Close
            </button>
          </div>
        )}

        {/* Audit Error Alert Only */}
        {auditError && (
          <div className="mt-3 p-2.5 text-xs rounded border border-red-500/30 bg-red-500/10 text-red-500 flex items-center justify-between">
            <span>{auditError}</span>
            <button
              onClick={() => setAuditError(null)}
              className="font-bold opacity-70 hover:opacity-100 ml-2 text-sm"
            >
              &times;
            </button>
          </div>
        )}

        {/* Main Grid */}
        <main className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 py-5">
          {/* Left Column: Canvas & Cadence Graph */}
          <section className="md:col-span-7 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-1 text-xs text-neutral-500">
              <div className="flex bg-neutral-100 dark:bg-neutral-900/80 p-0.5 rounded border border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => setView('draft')}
                  className={`px-3 py-1 rounded font-display tracking-wider uppercase text-xs transition ${
                    view === 'draft'
                      ? 'bg-white dark:bg-neutral-800 font-medium text-neutral-900 dark:text-neutral-100 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  Edit Draft
                </button>
                <button
                  onClick={() => setView('story')}
                  className={`px-3 py-1 rounded font-display tracking-wider uppercase text-xs transition flex items-center gap-1.5 ${
                    view === 'story'
                      ? 'bg-white dark:bg-neutral-800 font-medium text-neutral-900 dark:text-neutral-100 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  <span>Story Flow</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </button>
              </div>

              <div className="flex items-center gap-3 font-display uppercase tracking-wider text-xs">
                <span className={isOverXLimit ? 'text-red-500 font-bold' : ''}>
                  {text.length}{mode === 'x' ? ' / 280' : ' chars'}
                </span>
                <span>{activeAnalysis.wordCount} words</span>
              </div>
            </div>

            {/* Canvas View */}
            {view === 'draft' ? (
              <div className="space-y-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write raw draft here..."
                  className="w-full p-4 border border-neutral-200 dark:border-neutral-800/80 rounded bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm font-sans text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-neutral-400 min-h-[170px]"
                />

                {/* Live Story Flow: sentence colors update immediately while typing */}
                {activeAnalysis.sentences.length > 0 && (
                  <div className="p-3.5 border border-neutral-200 dark:border-neutral-800/80 rounded bg-white/20 dark:bg-neutral-900/20 backdrop-blur-sm text-sm leading-relaxed">
                    <div className="text-[10px] font-display uppercase tracking-wider text-neutral-400 mb-1.5 flex justify-between">
                      <span>Live Story Flow</span>
                      <button
                        onClick={() => setView('story')}
                        className="text-neutral-400 hover:text-white transition"
                      >
                        Inspect Story &rarr;
                      </button>
                    </div>
                    <p className="inline leading-relaxed">
                      {activeAnalysis.sentences.map((s, idx) => {
                        const color = sentenceColors[idx] || { textColor: 'text-neutral-400', hex: '#9ca3af' };
                        return (
                          <span
                            key={s.id || idx}
                            className={`${color.textColor} ${
                              s.leaks.length > 0 ? 'underline decoration-wavy decoration-red-500' : ''
                            } mr-1.5`}
                          >
                            {s.text}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="w-full p-4 border border-neutral-200 dark:border-neutral-800/80 rounded bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm text-sm leading-relaxed min-h-[180px]"
                >
                  {activeAnalysis.sentences.length === 0 ? (
                    <p className="text-neutral-500 font-display uppercase tracking-wider">
                      Write text in Edit Draft to view story flow.
                    </p>
                  ) : (
                    <p className="inline leading-relaxed">
                      {activeAnalysis.sentences.map((s, idx) => {
                        const color = sentenceColors[idx] || { textColor: 'text-neutral-400', hex: '#9ca3af' };
                        return (
                          <span
                            key={s.id || idx}
                            onClick={() => setSelectedSentenceIndex(idx)}
                            className={`${color.textColor} ${
                              s.leaks.length > 0 ? 'underline decoration-wavy decoration-red-500' : ''
                            } ${
                              selectedSentenceIndex === idx ? 'bg-white/10 px-1 py-0.5 rounded' : ''
                            } cursor-pointer hover:opacity-80 transition-opacity mr-1.5`}
                            title={`Click to inspect • ${ROLE_LABELS[s.role]} • ${s.wordCount} words`}
                          >
                            {s.text}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>

                {/* Selected Sentence Inspector */}
                {selectedSentence && (
                  <div className="p-3.5 rounded border border-neutral-200 dark:border-neutral-800/80 bg-white/40 dark:bg-neutral-900/50 backdrop-blur-sm text-xs space-y-1">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span className="font-display uppercase tracking-wider text-xs">
                        Sentence {selectedSentenceIndex! + 1} ({ROLE_LABELS[selectedSentence.role]} • {selectedSentence.wordCount}w)
                      </span>
                      <button
                        onClick={() => setSelectedSentenceIndex(null)}
                        className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 text-sm"
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
              sentenceColors={sentenceColors}
              selectedIndex={selectedSentenceIndex}
              onSelect={(idx) => setSelectedSentenceIndex(idx)}
            />
          </section>

          {/* Right Column: Pre-Publish Checklist & Ask Yourself This */}
          <section className="md:col-span-5 flex flex-col space-y-6">
            {/* Pre-Publish Checklist */}
            <div className="p-4 border border-neutral-200 dark:border-neutral-800/80 rounded bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm space-y-3">
              <div className="font-display text-lg tracking-wider uppercase text-neutral-800 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800/80 pb-2">
                Pre-Publish Checklist
              </div>
              <ul className="space-y-2.5 text-sm">
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
                    <li key={key} className="flex items-center gap-2.5">
                      <span className={`text-xs font-mono font-bold ${passed ? 'text-emerald-500' : 'text-neutral-500'}`}>
                        {passed ? '[x]' : '[ ]'}
                      </span>
                      <span className={passed ? 'text-neutral-800 dark:text-neutral-200 font-medium' : 'text-neutral-500'}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Ask Yourself This */}
            <div className="p-4 border border-neutral-200 dark:border-neutral-800/80 rounded bg-white/30 dark:bg-neutral-900/30 backdrop-blur-sm space-y-3">
              <div className="font-display text-lg tracking-wider uppercase text-neutral-800 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800/80 pb-2 flex items-center justify-between">
                <span>Ask Yourself This</span>
                {auditResult && (
                  <span className="font-display text-xs text-emerald-500 tracking-wider lowercase">
                    active
                  </span>
                )}
              </div>
              {activeAnalysis.coachingChallenges.length === 0 ? (
                <p className="text-xs text-neutral-500">All checks pass. Ready to ship.</p>
              ) : (
                <ul className="space-y-2.5">
                  {activeAnalysis.coachingChallenges.map((challenge, i) => (
                    <li
                      key={i}
                      className="p-3 text-xs leading-relaxed rounded border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 bg-neutral-100/50 dark:bg-neutral-900/60"
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
    </div>
  );
}
