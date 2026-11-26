'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { WritingMode, AnalysisResult, SentenceAnalysis, SentenceRole } from '@/lib/types';
import { analyzeLocally } from '@/lib/heuristics';

type ThemeMode = 'dark' | 'light' | 'system';
type EditorFont = 'sans' | 'serif' | 'mono';
type FontSize = 'sm' | 'md' | 'lg';

const SAMPLE_TEXT = `Everyone thinks training larger models is the only path to better AI accuracy. They are wrong because scaling parameters hits severe memory bottlenecks on edge devices. Instead, we compressed a 7B model down to 1.8GB using 4-bit quantization, maintaining 94.2% benchmark accuracy across 100K images. This cuts deployment latency by 60% and saves $12K monthly in cloud compute costs.`;

const NARRATIVE_CYCLE_COLORS = [
  { textColor: 'text-rose-600 dark:text-rose-400', hex: '#fb7185' },
  { textColor: 'text-orange-600 dark:text-orange-400', hex: '#fb923c' },
  { textColor: 'text-amber-600 dark:text-amber-300', hex: '#facc15' },
  { textColor: 'text-emerald-600 dark:text-emerald-400', hex: '#34d399' },
  { textColor: 'text-purple-600 dark:text-purple-400', hex: '#c084fc' },
  { textColor: 'text-sky-600 dark:text-sky-400', hex: '#38bdf8' }
];

const ROLE_BASE_COLOR_INDEX: Record<SentenceRole, number> = {
  hook: 0,
  tension: 1,
  resolution: 2,
  proof: 4,
  neutral: -1
};

const ROLE_LABELS = {
  hook: 'Hook',
  tension: 'Tension',
  resolution: 'Resolution',
  proof: 'Proof',
  neutral: 'Narrative'
};

const FONT_CLASS: Record<EditorFont, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono'
};

const SIZE_CLASS: Record<FontSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

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
      <div className="h-20 flex items-center justify-center font-display uppercase tracking-wider text-xs text-[var(--fg-muted)] border border-[var(--border)] bg-[var(--card)] rounded">
        Cadence graph plots as you type
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
    <div className="p-4 border border-[var(--border)] rounded bg-[var(--card)] space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--fg-muted)] border-b border-[var(--border)] pb-2">
        <span className="font-display uppercase tracking-wider text-lg text-[var(--fg)]">
          Cadence Rhythm
        </span>
        <span className="font-display uppercase tracking-wider text-xs">
          Avg {Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)}w • {Math.min(...wordCounts)}–{Math.max(...wordCounts)}w
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
            className="text-neutral-300 dark:text-neutral-800"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="currentColor"
            strokeDasharray="2 3"
            className="text-neutral-300 dark:text-neutral-800"
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
                className="cursor-pointer group"
                onClick={() => onSelect(pt.index)}
              >
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6.5 : pt.sentence.isMonotonous ? 5.5 : 4}
                  fill={ptColor}
                  stroke={isSelected ? 'var(--fg)' : pt.sentence.isMonotonous ? '#ef4444' : 'transparent'}
                  strokeWidth="2"
                  style={{
                    transformOrigin: `${pt.x}px ${pt.y}px`,
                    transition: 'transform 0.15s ease'
                  }}
                  className="group-hover:scale-125"
                />
                <text
                  x={pt.x}
                  y={pt.y - 8}
                  textAnchor="middle"
                  className="text-[9px] fill-neutral-500 dark:fill-neutral-400 font-mono pointer-events-none select-none"
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
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [editorFont, setEditorFont] = useState<EditorFont>('sans');
  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [showGrid, setShowGrid] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isAuditing, startAuditing] = useTransition();
  const [auditResult, setAuditResult] = useState<AnalysisResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [soWhatChain, setSoWhatChain] = useState<string[] | null>(null);
  const [isDrilling, startDrilling] = useTransition();

  useEffect(() => {
    const savedKey = localStorage.getItem('copycraft_api_key');
    const savedModel = localStorage.getItem('copycraft_model');
    const savedTheme = localStorage.getItem('copycraft_theme') as ThemeMode | null;
    const savedFont = localStorage.getItem('copycraft_font') as EditorFont | null;
    const savedSize = localStorage.getItem('copycraft_font_size') as FontSize | null;
    const savedGrid = localStorage.getItem('copycraft_grid');

    if (savedTheme) setTheme(savedTheme);
    if (savedFont) setEditorFont(savedFont);
    if (savedSize) setFontSize(savedSize);
    if (savedGrid !== null) setShowGrid(savedGrid === 'true');
    if (savedKey) {
      setApiKey(savedKey);
      fetchModels(savedKey, savedModel || undefined);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
    };
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mq.matches);
      const onChange = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    }
    apply(theme === 'dark');
  }, [theme]);

  const updateTheme = (t: ThemeMode) => {
    setTheme(t);
    localStorage.setItem('copycraft_theme', t);
  };

  const updateFont = (f: EditorFont) => {
    setEditorFont(f);
    localStorage.setItem('copycraft_font', f);
  };

  const updateFontSize = (s: FontSize) => {
    setFontSize(s);
    localStorage.setItem('copycraft_font_size', s);
  };

  const toggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    localStorage.setItem('copycraft_grid', String(next));
  };

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
          const chosen = preserveModel && models.includes(preserveModel) ? preserveModel : models[0];
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
    setSoWhatChain(null);
  }, [text, auditResult]);

  const handleSoWhatDrill = () => {
    if (!text.trim()) return;
    setAuditError(null);
    startDrilling(async () => {
      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            mode,
            action: 'so_what',
            apiKey: apiKey.trim() || undefined,
            model: selectedModel || undefined
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.apiError) {
            setAuditError(data.apiError);
          } else if (data.soWhatChain) {
            setSoWhatChain(data.soWhatChain);
          }
        }
      } catch (err: any) {
        setAuditError(err?.message || 'Network error during drill');
      }
    });
  };

  const handleListen = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

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
            if (data.soWhatChain) setSoWhatChain(data.soWhatChain);
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
  const selectedSentence = selectedSentenceIndex !== null ? activeAnalysis.sentences[selectedSentenceIndex] : null;
  const editorTypography = `${FONT_CLASS[editorFont]} ${SIZE_CLASS[fontSize]}`;

  return (
    <div className={`min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg)] text-[var(--fg)] ${showGrid ? 'bg-grid-subtle' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col min-h-screen lg:h-full">
        {/* Header */}
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-6">
            <span className="font-display text-2xl tracking-wider uppercase text-[var(--fg)]">
              CopyCraft
            </span>
            <nav className="flex gap-1 bg-[var(--muted)] p-0.5 rounded border border-[var(--border)]">
              {(['x', 'blog', 'pitch'] as WritingMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded font-display text-xs uppercase tracking-wider transition ${
                    mode === m
                      ? 'bg-[var(--tab-active)] text-[var(--tab-active-fg)] shadow-sm'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  {m === 'x' ? 'X Post' : m === 'blog' ? 'Blog' : 'Pitch'}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAudit}
              disabled={isAuditing || !text.trim()}
              className="px-4 py-1.5 font-display text-xs tracking-wider uppercase rounded bg-[var(--accent-bg)] text-[var(--accent-fg)] hover:opacity-90 transition disabled:opacity-50"
            >
              {isAuditing ? 'Auditing...' : 'Run Coach Audit'}
            </button>
            <button
              onClick={handleListen}
              disabled={!text.trim()}
              className={`px-3.5 py-1.5 font-display text-xs tracking-wider uppercase border rounded transition disabled:opacity-50 ${
                isSpeaking
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:opacity-80'
              }`}
            >
              {isSpeaking ? 'Stop' : 'Listen'}
            </button>
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 font-display text-xs tracking-wider uppercase border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] rounded hover:opacity-80 transition"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </header>

        {/* Audit Error Alert Only */}
        {auditError && (
          <div className="shrink-0 mt-3 p-2.5 text-xs rounded border border-red-500/30 bg-red-500/10 text-red-500 flex items-center justify-between">
            <span>{auditError}</span>
            <button
              onClick={() => setAuditError(null)}
              className="font-bold opacity-70 hover:opacity-100 ml-2 text-sm"
            >
              &times;
            </button>
          </div>
        )}

        {/* 3-Pane Workspace: each pane independently scrollable */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 py-4">
          {/* Left Pane: Settings */}
          <aside className="lg:col-span-3 lg:h-full lg:overflow-y-auto min-h-0 pr-1">
            <div className="p-4 border border-[var(--border)] rounded bg-[var(--card)] space-y-4">
              <div className="font-display text-lg tracking-wider uppercase text-[var(--fg)] border-b border-[var(--border)] pb-2">
                Settings
              </div>

              {/* Theme */}
              <div className="space-y-1.5">
                <div className="font-display text-xs uppercase tracking-wider text-[var(--fg-muted)]">
                  Theme
                </div>
                <div className="grid grid-cols-3 gap-1 bg-[var(--muted)] p-0.5 rounded border border-[var(--border)]">
                  {(['dark', 'light', 'system'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateTheme(t)}
                      className={`py-1 rounded font-display text-xs uppercase tracking-wider transition ${
                        theme === t
                          ? 'bg-[var(--tab-active)] text-[var(--tab-active-fg)] shadow-sm'
                          : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor Font */}
              <div className="space-y-1.5">
                <div className="font-display text-xs uppercase tracking-wider text-[var(--fg-muted)]">
                  Editor Font
                </div>
                <div className="grid grid-cols-3 gap-1 bg-[var(--muted)] p-0.5 rounded border border-[var(--border)]">
                  {(['sans', 'serif', 'mono'] as EditorFont[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => updateFont(f)}
                      className={`py-1 rounded font-display text-xs uppercase tracking-wider transition ${
                        editorFont === f
                          ? 'bg-[var(--tab-active)] text-[var(--tab-active-fg)] shadow-sm'
                          : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="font-display text-xs uppercase tracking-wider text-[var(--fg-muted)]">
                  Font Size
                </div>
                <div className="grid grid-cols-3 gap-1 bg-[var(--muted)] p-0.5 rounded border border-[var(--border)]">
                  {(['sm', 'md', 'lg'] as FontSize[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateFontSize(s)}
                      className={`py-1 rounded font-display text-xs uppercase tracking-wider transition ${
                        fontSize === s
                          ? 'bg-[var(--tab-active)] text-[var(--tab-active-fg)] shadow-sm'
                          : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Grid */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-display text-xs uppercase tracking-wider text-[var(--fg-muted)]">
                  Bg Grid
                </span>
                <button
                  onClick={toggleGrid}
                  className="px-2.5 py-0.5 rounded font-display text-xs uppercase tracking-wider border border-[var(--border)] bg-[var(--muted)] text-[var(--fg)]"
                >
                  {showGrid ? 'On' : 'Off'}
                </button>
              </div>

              {/* API Key & Model */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <div className="font-display text-xs uppercase tracking-wider text-[var(--fg-muted)]">
                  API Key (Groq / Gemini)
                </div>
                <input
                  type="password"
                  placeholder="gsk_... or Gemini key"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[var(--border)] bg-[var(--input-bg)] text-[var(--fg)] rounded font-mono text-xs focus:outline-none"
                />
                {isLoadingModels ? (
                  <p className="text-xs text-[var(--fg-muted)] font-mono">Fetching models...</p>
                ) : availableModels.length > 0 ? (
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[var(--border)] bg-[var(--input-bg)] text-[var(--fg)] rounded font-mono text-xs focus:outline-none"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          </aside>

          {/* Center Pane: Canvas */}
          <section className="lg:col-span-5 lg:h-full min-h-0 flex flex-col space-y-3">
            <div className="shrink-0 flex items-center justify-between pb-1 text-xs text-[var(--fg-muted)]">
              <div className="flex bg-[var(--muted)] p-0.5 rounded border border-[var(--border)]">
                <button
                  onClick={() => setView('draft')}
                  className={`px-3 py-1 rounded font-display tracking-wider uppercase text-xs transition ${
                    view === 'draft'
                      ? 'bg-[var(--tab-active)] font-medium text-[var(--tab-active-fg)] shadow-sm'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  Edit Draft
                </button>
                <button
                  onClick={() => setView('story')}
                  className={`px-3 py-1 rounded font-display tracking-wider uppercase text-xs transition flex items-center gap-1.5 ${
                    view === 'story'
                      ? 'bg-[var(--tab-active)] font-medium text-[var(--tab-active-fg)] shadow-sm'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <span>Story Flow</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 font-display uppercase tracking-wider text-xs">
                <span className={isOverXLimit ? 'text-red-500 font-bold' : ''}>
                  {text.length}{mode === 'x' ? ' / 280' : ' chars'}
                </span>
                <span>
                  {activeAnalysis.wordCount}w (${activeAnalysis.wordCount * 10})
                </span>
                {activeAnalysis.readingGrade > 0 && (
                  <span className={activeAnalysis.readingGrade > 10 ? 'text-amber-500' : ''}>
                    Grade {activeAnalysis.readingGrade}
                  </span>
                )}
              </div>
            </div>

            {view === 'draft' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write raw draft here..."
                className={`flex-1 min-h-[300px] lg:min-h-0 w-full p-4 border border-[var(--border)] rounded bg-[var(--card)] text-[var(--fg)] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-neutral-400 overflow-y-auto ${editorTypography}`}
              />
            ) : (
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                <div
                  className={`flex-1 min-h-[260px] lg:min-h-0 overflow-y-auto w-full p-4 border border-[var(--border)] rounded bg-[var(--card)] leading-relaxed ${editorTypography}`}
                >
                  {activeAnalysis.sentences.length === 0 ? (
                    <p className="text-[var(--fg-muted)] font-display uppercase tracking-wider">
                      Write text in Edit Draft to view story flow.
                    </p>
                  ) : (
                    <p className="inline leading-relaxed">
                      {activeAnalysis.sentences.map((s, idx) => {
                        const color = sentenceColors[idx] || { textColor: 'text-[var(--fg-muted)]', hex: '#9ca3af' };
                        return (
                          <span
                            key={s.id || idx}
                            onClick={() => setSelectedSentenceIndex(idx)}
                            className={`${color.textColor} ${
                              s.leaks.length > 0 ? 'underline decoration-wavy decoration-red-500' : ''
                            } ${
                              selectedSentenceIndex === idx ? 'bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded' : ''
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

                {selectedSentence && (
                  <div className="shrink-0 p-3.5 rounded border border-[var(--border)] bg-[var(--card)] text-xs space-y-1">
                    <div className="flex items-center justify-between text-[var(--fg-muted)]">
                      <span className="font-display uppercase tracking-wider text-xs">
                        Sentence {selectedSentenceIndex! + 1} ({ROLE_LABELS[selectedSentence.role]} • {selectedSentence.wordCount}w)
                      </span>
                      <button
                        onClick={() => setSelectedSentenceIndex(null)}
                        className="hover:text-[var(--fg)] text-sm"
                      >
                        &times;
                      </button>
                    </div>
                    {selectedSentence.tip ? (
                      <p className="text-[var(--fg)] italic">
                        Coach Tip: {selectedSentence.tip}
                      </p>
                    ) : (
                      <p className="text-[var(--fg-muted)]">
                        {selectedSentence.leaks.length > 0
                          ? `Leaks: ${selectedSentence.leaks.join(', ')}`
                          : 'Sentence structurally sound.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Right Pane: Pre-Publish Checklist, Cadence Rhythm Graph, Ask Yourself This */}
          <section className="lg:col-span-4 lg:h-full lg:overflow-y-auto min-h-0 flex flex-col space-y-4 pr-1">
            {/* Pre-Publish Checklist */}
            <div className="p-4 border border-[var(--border)] rounded bg-[var(--card)] space-y-3">
              <div className="font-display text-lg tracking-wider uppercase text-[var(--fg)] border-b border-[var(--border)] pb-2">
                Pre-Publish Checklist
              </div>
              <ul className="space-y-2 text-sm">
                {[
                  { key: 'strongHook', label: 'Hook punchiness' },
                  { key: 'clearOutcome', label: 'Clear outcome ("So What?")' },
                  { key: 'tensionPivot', label: 'Tension / Conflict beat' },
                  { key: 'concreteProof', label: 'Concrete proof (Deaf & Mute)' },
                  { key: 'conciseWords', label: 'No $10-word copy leaks' },
                  { key: 'variedCadence', label: 'Varied sentence cadence' },
                  ...(mode === 'pitch'
                    ? [
                        { key: 'giveBeforeAsk', label: 'Give before ask (Upfront work)' },
                        { key: 'hasUrgency', label: 'Priority / Cost of inaction' },
                        { key: 'hasCta', label: 'Clear CTA (Who/What/How)' }
                      ]
                    : [])
                ].map(({ key, label }) => {
                  const passed = activeAnalysis.checklist[key as keyof typeof activeAnalysis.checklist];
                  return (
                    <li key={key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-mono font-bold ${passed ? 'text-emerald-600 dark:text-emerald-500' : 'text-[var(--fg-muted)]'}`}>
                          {passed ? '[x]' : '[ ]'}
                        </span>
                        <span className={passed ? 'text-[var(--fg)] font-medium' : 'text-[var(--fg-muted)]'}>
                          {label}
                        </span>
                      </div>
                      {key === 'clearOutcome' && !passed && text.trim() && (
                        <button
                          onClick={handleSoWhatDrill}
                          disabled={isDrilling}
                          className="font-display text-[11px] tracking-wider uppercase text-amber-600 dark:text-amber-500 hover:underline disabled:opacity-50"
                        >
                          {isDrilling ? 'Drilling...' : 'So What? Drill'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Cadence Rhythm Graph */}
            <CadenceLineGraph
              sentences={activeAnalysis.sentences}
              sentenceColors={sentenceColors}
              selectedIndex={selectedSentenceIndex}
              onSelect={(idx) => setSelectedSentenceIndex(idx)}
            />

            {/* Ask Yourself This */}
            <div className="p-4 border border-[var(--border)] rounded bg-[var(--card)] space-y-3">
              <div className="font-display text-lg tracking-wider uppercase text-[var(--fg)] border-b border-[var(--border)] pb-2 flex items-center justify-between">
                <span>Ask Yourself This</span>
                <div className="flex items-center gap-3">
                  {text.trim() && (
                    <button
                      onClick={handleSoWhatDrill}
                      disabled={isDrilling}
                      className="font-display text-xs tracking-wider uppercase text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      {isDrilling ? 'Drilling...' : 'So What? Drill'}
                    </button>
                  )}
                  {auditResult && (
                    <span className="font-display text-xs text-emerald-500 tracking-wider lowercase">
                      active
                    </span>
                  )}
                </div>
              </div>
              {soWhatChain && soWhatChain.length > 0 && (
                <ul className="space-y-1.5 p-3 text-xs rounded border border-amber-500/30 bg-amber-500/5 text-[var(--fg)]">
                  {soWhatChain.map((step, i) => (
                    <li key={i} className={i === soWhatChain.length - 1 ? 'font-medium text-amber-600 dark:text-amber-500' : ''}>
                      {step}
                    </li>
                  ))}
                </ul>
              )}
              {activeAnalysis.coachingChallenges.length === 0 ? (
                <p className="text-xs text-[var(--fg-muted)]">All checks pass. Ready to ship.</p>
              ) : (
                <ul className="space-y-2.5">
                  {activeAnalysis.coachingChallenges.map((challenge, i) => (
                    <li
                      key={i}
                      className="p-3 text-xs leading-relaxed rounded border border-[var(--border)] text-[var(--fg)] bg-[var(--muted)]"
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
