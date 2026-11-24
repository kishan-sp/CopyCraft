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

function CadenceLineGraph({ sentences }: { sentences: SentenceAnalysis[] }) {
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
          {/* Reference guides */}
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

          {/* Cadence Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-neutral-400 dark:text-neutral-600"
            />
          )}

          {/* Points */}
          {points.map((pt) => {
            const roleColor = ROLE_HEX_COLORS[pt.sentence.role] || '#9ca3af';
            return (
              <g key={pt.index} className="group cursor-pointer">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.sentence.isMonotonous ? '6' : '4.5'}
                  fill={roleColor}
                  stroke={pt.sentence.isMonotonous ? '#ef4444' : 'transparent'}
                  strokeWidth={pt.sentence.isMonotonous ? '2' : '0'}
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
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isAuditing, startAuditing] = useTransition();
  const [auditResult, setAuditResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('copycraft_api_key');
    if (saved) setApiKey(saved);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('copycraft_api_key', key);
  };

  const localAnalysis = useMemo(() => analyzeLocally(text, mode), [text, mode]);
  const activeAnalysis = auditResult || localAnalysis;

  useEffect(() => {
    if (auditResult && auditResult.charCount !== text.length) {
      setAuditResult(null);
    }
  }, [text, auditResult]);

  const handleAudit = () => {
    if (!text.trim()) return;
    startAuditing(async () => {
      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, mode, apiKey: apiKey.trim() || undefined })
        });
        if (res.ok) {
          const data = await res.json();
          setAuditResult(data);
        }
      } catch {
        // Fallback remains on local
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
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 underline"
          >
            {keyType ? `${keyType} Key Set` : 'Paste Groq / Gemini Key'}
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

      {/* Groq / Gemini API Key Input */}
      {showKeyInput && (
        <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-neutral-500">API Key:</span>
            <input
              type="password"
              placeholder="Paste Groq key (gsk_...) or Gemini key"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              className="flex-1 max-w-md px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded font-mono text-xs"
            />
            {keyType && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-200 dark:bg-neutral-800 font-medium">
                Detected: {keyType}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowKeyInput(false)}
            className="px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      )}

      {/* Main Split Interface */}
      <main className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 py-4">
        {/* Left Column: Canvas & Cadence Graph */}
        <section className="md:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-1 text-xs text-neutral-500">
            {/* View switcher: Raw Editor vs Continuous Story Flow */}
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
            /* Continuous Inline Colored Paragraph */
            <div
              onClick={() => setView('draft')}
              title="Click to edit"
              className="w-full p-4 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-900/40 text-sm leading-relaxed min-h-[220px] cursor-text"
            >
              {activeAnalysis.sentences.length === 0 ? (
                <p className="text-neutral-400">Write text in Edit Draft to view story flow.</p>
              ) : (
                <p className="inline leading-relaxed">
                  {activeAnalysis.sentences.map((s, idx) => (
                    <span
                      key={s.id || idx}
                      className={`${ROLE_TEXT_COLORS[s.role]} ${
                        s.leaks.length > 0 ? 'underline decoration-wavy decoration-red-500' : ''
                      } transition-opacity mr-1.5`}
                      title={`${ROLE_LABELS[s.role]} • ${s.wordCount} words${
                        s.leaks.length > 0 ? ` • Leak: ${s.leaks.join(', ')}` : ''
                      }`}
                    >
                      {s.text}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          {/* Visual Cadence Line Graph */}
          <CadenceLineGraph sentences={activeAnalysis.sentences} />
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
            <div className="pb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Socratic Challenges
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
