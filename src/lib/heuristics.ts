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

export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const matches = text.match(/[^.!?\n]+([.!?]+|\n+|$)/g);
  if (!matches) return [text];
  return matches
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function analyzeLocally(text: string, mode: WritingMode = 'x'): AnalysisResult {
  const trimmed = text ? text.trim() : '';
  const isBlank = trimmed.length === 0;
  const rawSentences = isBlank ? [] : splitIntoSentences(text);
  const totalChars = text.length;
  const totalWords = isBlank ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
  const readTimeSeconds = Math.max(0, Math.round((totalWords / 200) * 60));

  let monotonyStreaks: boolean[] = new Array(rawSentences.length).fill(false);
  const wordCounts = rawSentences.map(s => s.trim().split(/\s+/).filter(Boolean).length);

  // Cadence Monotony: 3+ consecutive sentences with identical word count
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
    for (const pattern of FILLER_PATTERNS) {
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

  const challenges: string[] = [];
  if (isBlank) {
    challenges.push("Write or paste a draft to begin Socratic evaluation.");
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
    if (mode === 'x' && totalChars > 280) {
      challenges.push(`X post is ${totalChars - 280} characters over the 280 limit. Cut ruthlessly.`);
    }
  }

  // Pre-publish checklist: strictly false when blank
  const checklist: PrePublishChecklist = {
    strongHook: !isBlank && analyzedSentences.length > 0 && analyzedSentences[0].wordCount <= 25,
    clearOutcome: !isBlank && (hasOutcomeOverall || (mode === 'pitch' && totalWords > 10)),
    tensionPivot: !isBlank && hasTensionOverall,
    concreteProof: !isBlank && hasProofOverall,
    conciseWords: !isBlank && totalLeaksCount === 0,
    variedCadence: !isBlank && rawSentences.length > 1 && !monotonyStreaks.some(Boolean),
  };

  return {
    sentences: analyzedSentences,
    checklist,
    charCount: totalChars,
    wordCount: totalWords,
    readTimeSeconds,
    coachingChallenges: challenges.slice(0, 3),
  };
}
