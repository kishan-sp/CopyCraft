'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { WritingMode, AnalysisResult } from '@/lib/types';
import { analyzeLocally } from '@/lib/heuristics';

const SAMPLE_TEXT = `Everyone thinks training larger models is the only path to better AI accuracy.
They are wrong because scaling parameters hits severe memory bottlenecks on edge devices.
Instead, we compressed a 7B model down to 1.8GB using 4-bit quantization, maintaining 94.2% benchmark accuracy across 100K images.
This cuts deployment latency by 60% and saves $12K monthly in cloud compute costs.`;

const ROLE_STYLES = {
  hook: 'border-l-4 border-blue-500 bg-blue-500/10 dark:bg-blue-500/20 text-blue-950 dark:text-blue-100 p-2.5 rounded-r',
  tension: 'border-l-4 border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 text-amber-950 dark:text-amber-100 p-2.5 rounded-r',
  resolution: 'border-l-4 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 p-2.5 rounded-r',
  proof: 'border-l-4 border-purple-500 bg-purple-500/10 dark:bg-purple-500/20 text-purple-950 dark:text-purple-100 p-2.5 rounded-r',
  neutral: 'border-l-4 border-neutral-300 dark:border-neutral-700 bg-neutral-100/40 dark:bg-neutral-800/40 p-2.5 rounded-r'
};

const ROLE_PILL_STYLES = {
  hook: 'bg-blue-500 text-white',
  tension: 'bg-amber-500 text-white',
  resolution: 'bg-emerald-500 text-white',
  proof: 'bg-purple-500 text-white',
  neutral: 'bg-neutral-400 text-white'
};

const ROLE_LABELS = {
  hook: 'Hook',
  tension: 'Tension',
  resolution: 'Resolution',
  proof: 'Proof',
  neutral: 'Narrative'
};

export default function Page() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [mode, setMode] = useState<WritingMode>('x');
  const [view, setView] = useState<'draft' | 'lens'>('draft');
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isAuditing, startAuditing] = useTransition();
  const [auditResult, setAuditResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Load API key from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('copycraft_api_key');
    if (saved) setApiKey(saved);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('copycraft_api_key', key);
  };

  // Instant local deterministic analysis on every keystroke
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
        {/* Left Column: Canvas */}
        <section className="md:col-span-7 flex flex-col">
          <div className="flex items-center justify-between pb-2 text-xs text-neutral-500">
            {/* Prominent Tab Switcher */}
            <div className="flex bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded">
              <button
                onClick={() => setView('draft')}
                className={`px-3 py-1 rounded transition text-xs ${
                  view === 'draft'
                    ? 'bg-white dark:bg-neutral-800 font-medium shadow-sm text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Draft Editor
              </button>
              <button
                onClick={() => setView('lens')}
                className={`px-3 py-1 rounded transition text-xs flex items-center gap-1.5 ${
                  view === 'lens'
                    ? 'bg-white dark:bg-neutral-800 font-medium shadow-sm text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <span>Story Lens</span>
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

          {view === 'draft' ? (
            <div className="flex-1 flex flex-col space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write raw draft here..."
                className="flex-1 w-full p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-transparent font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-neutral-400 min-h-[340px]"
              />

              {/* Real-time Sentence Cadence Strip under Editor */}
              {activeAnalysis.sentences.length > 0 && (
                <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50/50 dark:bg-neutral-900/30">
                  <div className="text-[11px] text-neutral-400 mb-1 flex justify-between">
                    <span>Live Cadence Rhythm</span>
                    <button
                      onClick={() => setView('lens')}
                      className="text-neutral-600 dark:text-neutral-300 hover:underline"
                    >
                      View Highlighted Lens &rarr;
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeAnalysis.sentences.map((s, idx) => (
                      <span
                        key={idx}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${ROLE_PILL_STYLES[s.role]}`}
                        title={`${ROLE_LABELS[s.role]}: ${s.wordCount} words`}
                      >
                        S{idx + 1}: {s.wordCount}w
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 p-3 border border-neutral-200 dark:border-neutral-800 rounded space-y-2.5 overflow-y-auto min-h-[380px]">
              {activeAnalysis.sentences.length === 0 ? (
                <p className="text-neutral-400 text-sm">Write or paste text in the Draft Editor to view highlighted sentences.</p>
              ) : (
                activeAnalysis.sentences.map((s, idx) => (
                  <div key={s.id || idx} className={`${ROLE_STYLES[s.role]} space-y-1`}>
                    <div className="flex items-center justify-between text-[11px] font-semibold opacity-80">
                      <span>{ROLE_LABELS[s.role]}</span>
                      <span>{s.wordCount} words</span>
                    </div>
                    <p className="text-sm leading-relaxed font-sans">
                      {s.text}
                    </p>
                    {s.isMonotonous && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Monotonous length: matches adjacent sentence lengths.</p>
                    )}
                    {s.leaks.length > 0 && (
                      <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                        Leak: {s.leaks.join(', ')}
                      </div>
                    )}
                    {s.tip && (
                      <p className="text-xs opacity-75 italic">{s.tip}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
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
