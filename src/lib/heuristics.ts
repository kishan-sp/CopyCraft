import { AnalysisResult, PrePublishChecklist, SentenceAnalysis, SentenceRole, WritingMode } from './types';

const FILLER_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /\bin order to\b/gi, label: 'Cut "in order to" -> use "to"' },
  { regex: /\bdue to the fact that\b/gi, label: 'Cut "due to the fact that" -> use "because"' },
  { regex: /\bat the end of the day\b/gi, label: 'Cut cliché "at the end of the day"' },
  { regex: /\bfor the purpose of\b/gi, label: 'Cut "for the purpose of" -> use "to"' },
  { regex: /\bneedless to say\b/gi, label: 'Cut "needless to say"' },
  { regex: /\b(basically|literally|actually|really|very)\b/gi, label: 'Cut filler adverb' },
  { regex: /\b(synergy|utilize|leverage|bandwidth)\b/gi, label: 'Replace corporate buzzword' },
  { regex: /\b(is|are|was|were|been|being)\s+([a-z]+ed|[a-z]+en)\s+by\b/gi, label: 'Passive voice leak' }
];

const PROOF_REGEX = /(\b\d+(\.\d+)?%|\$\d+(\.\d+)?|\b\d+[kKmMbB]\b|\b\d+\s*(images|users|ms|seconds|minutes|hours|days|x|fold|accuracy|latency|lines|repos|stars|downloads|clients)\b|https?:\/\/\S+|\b(github|gitlab|figma)\.com\S*)/i;
const TENSION_REGEX = /\b(but|however|yet|although|though|instead|except|whereas|nevertheless|bottleneck|wall|failed|flaw|problem|conflict|trap|mistake)\b/i;
const RESOLUTION_REGEX = /\b(therefore|so|thus|hence|solution|result|built|created|shipped|fixed|solved|unlocked|discovered|now|outcome)\b/i;
const OUTCOME_REGEX = /\b(save|saving|make|making|cut|cutting|reduce|reducing|boost|growth|revenue|profit|scale|convert|speed|hire|landed)\b/i;
const CTA_REGEX = /(\b(dm|reply|book|schedule|click|try|join|sign up|reach out|let's talk|grab|link|calendar|call)\b|\?$)/i;
const URGENCY_REGEX = /\b(now|today|this week|before|cost of|losing|wasting|missing|limited|deadline|every day|every month|burn|risk)\b/i;
const GIVE_BEFORE_ASK_REGEX = /\b(attached|breakdown|audit|feedback|built|put together|noticed|spotted|redesign|mockup|sample|drafted|recorded|loom)\b/i;

const PITCH_LEAK_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /\bwould love to connect\b/gi, label: 'Generic opener ("would love to connect")' },
  { regex: /\bpick your brain\b/gi, label: 'High-friction ask ("pick your brain")' },
  { regex: /\bto whom it may concern\b/gi, label: 'Impersonal greeting' },
  { regex: /\bfollowing up\b/gi, label: 'Weak opener ("following up")' },
  { regex: /\b(hard worker|fast learner|team player)\b/gi, label: 'Telling instead of showing' }
];

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) return cleaned.length > 0 ? 1 : 0;
  const normalized = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const matches = normalized.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

function computeReadingGrade(text: string, sentenceCount: number, wordCount: number): number {
  if (wordCount === 0 || sentenceCount === 0) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllables / wordCount) - 15.59;
  return Math.max(1, Math.min(18, Math.round(grade)));
}

export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  const sentenceEndRegex = /(?<=[.!?])(?<!\d\.)(?<!\b(?:e\.g|i\.e|vs|mr|mrs|dr|prof)\.)\s+(?=[A-Z0-9"'\n]|$)/gi;

  const paragraphs = text.split(/\n+/);
  const result: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const sentences = trimmed.split(sentenceEndRegex).map(s => s.trim()).filter(Boolean);
    result.push(...sentences);
  }

  return result.length > 0 ? result : [text.trim()];
}

export function analyzeLocally(text: string, mode: WritingMode = 'x'): AnalysisResult {
  const trimmed = text ? text.trim() : '';
  const isBlank = trimmed.length === 0;
  const rawSentences = isBlank ? [] : splitIntoSentences(text);
  const totalChars = text.length;
  const totalWords = isBlank ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
  const readTimeSeconds = Math.max(0, Math.round((totalWords / 200) * 60));
  const readingGrade = isBlank ? 0 : computeReadingGrade(trimmed, rawSentences.length, totalWords);

  let monotonyStreaks: boolean[] = new Array(rawSentences.length).fill(false);
  const wordCounts = rawSentences.map(s => s.trim().split(/\s+/).filter(Boolean).length);

  let currentStreak = 1;
  for (let i = 1; i < wordCounts.length; i++) {
    if (wordCounts[i] === wordCounts[i - 1] && wordCounts[i] > 2) {
      currentStreak++;
      if (currentStreak >= 3) {
        for (let j = i - currentStreak + 1; j <= i; j++) {
          monotonyStreaks[j] = true;
        }
      }
    } else {
      currentStreak = 1;
    }
  }

  let totalLeaksCount = 0;
  let hasTensionOverall = false;
  let hasProofOverall = false;
  let hasOutcomeOverall = false;

  const analyzedSentences: SentenceAnalysis[] = rawSentences.map((sentence, idx) => {
    const sWords = wordCounts[idx];
    const sChars = sentence.length;
    const hasProof = PROOF_REGEX.test(sentence);
    const hasTension = TENSION_REGEX.test(sentence);
    const hasResolution = RESOLUTION_REGEX.test(sentence);
    const hasOutcome = OUTCOME_REGEX.test(sentence);

    if (hasProof) hasProofOverall = true;
    if (hasTension) hasTensionOverall = true;
    if (hasOutcome) hasOutcomeOverall = true;

    const leaks: string[] = [];
    const activePatterns = mode === 'pitch' ? [...FILLER_PATTERNS, ...PITCH_LEAK_PATTERNS] : FILLER_PATTERNS;
    for (const pattern of activePatterns) {
      if (pattern.regex.test(sentence)) {
        leaks.push(pattern.label);
        totalLeaksCount++;
      }
    }

    let role: SentenceRole = 'neutral';
    if (idx === 0) {
      role = 'hook';
    } else if (hasProof) {
      role = 'proof';
    } else if (hasTension) {
      role = 'tension';
    } else if (hasResolution) {
      role = 'resolution';
    }

    return {
      id: `s-${idx}-${sentence.slice(0, 10).replace(/\W/g, '')}`,
      text: sentence,
      wordCount: sWords,
      charCount: sChars,
      role,
      leaks,
      hasProof,
      hasTension,
      isMonotonous: monotonyStreaks[idx],
    };
  });

  const hasCtaOverall = !isBlank && CTA_REGEX.test(trimmed);
  const hasUrgencyOverall = !isBlank && URGENCY_REGEX.test(trimmed);
  const hasGiveOverall = !isBlank && GIVE_BEFORE_ASK_REGEX.test(trimmed);

  const challenges: string[] = [];
  if (isBlank) {
    challenges.push("Write or paste a draft to begin real-time evaluation.");
  } else {
    if (!hasTensionOverall) {
      challenges.push("Your story is purely linear (and then... and then...). Insert a 'But' or conflict beat to create tension.");
    }
    if (!hasProofOverall && totalWords > 15) {
      challenges.push("Pass the Deaf & Mute test: Add at least one concrete number, metric (%), or verifiable artifact.");
    }
    if (totalLeaksCount > 0) {
      challenges.push(`Detected ${totalLeaksCount} $10-word copy leak${totalLeaksCount > 1 ? 's' : ''}. Cut filler adverbs and simplify wording.`);
    }
    if (monotonyStreaks.some(Boolean)) {
      challenges.push("Monotonous cadence detected: 3+ consecutive sentences have the exact same length. Vary your sentence rhythm.");
    }
    if (readingGrade > 10) {
      challenges.push(`Fire Fighter Test: Reading level is Grade ${readingGrade}. Simplify words and split dense clauses so it reads at Grade 8 or lower.`);
    }
    if (mode === 'x' && totalChars > 280) {
      challenges.push(`X post is ${totalChars - 280} characters over the 280 limit. Cut ruthlessly.`);
    }
    if (mode === 'pitch') {
      if (!hasGiveOverall) {
        challenges.push("Permissionless pitch: Lead with upfront value (feedback, breakdown, or sample) so the ask feels like a give.");
      }
      if (!hasUrgencyOverall) {
        challenges.push("Priority missing: Why should they act now? Highlight urgency or the cost of inaction.");
      }
      if (!hasCtaOverall) {
        challenges.push("CTA missing: Specify Who, What, When, and How they should respond.");
      }
    }
  }

  const checklist: PrePublishChecklist = {
    strongHook: !isBlank && analyzedSentences.length > 0 && analyzedSentences[0].wordCount <= 25,
    clearOutcome: !isBlank && hasOutcomeOverall,
    tensionPivot: !isBlank && hasTensionOverall,
    concreteProof: !isBlank && hasProofOverall,
    conciseWords: !isBlank && totalLeaksCount === 0,
    variedCadence: !isBlank && rawSentences.length > 1 && !monotonyStreaks.some(Boolean),
    ...(mode === 'pitch' ? { hasCta: hasCtaOverall, hasUrgency: hasUrgencyOverall, giveBeforeAsk: hasGiveOverall } : {}),
  };

  return {
    sentences: analyzedSentences,
    checklist,
    charCount: totalChars,
    wordCount: totalWords,
    readTimeSeconds,
    readingGrade,
    coachingChallenges: challenges.slice(0, 3),
  };
}
