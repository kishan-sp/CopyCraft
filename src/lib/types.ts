export type SentenceRole = 'hook' | 'tension' | 'resolution' | 'proof' | 'neutral';

export type WritingMode = 'x' | 'blog' | 'pitch';

export interface SentenceAnalysis {
  id: string;
  text: string;
  wordCount: number;
  charCount: number;
  role: SentenceRole;
  leaks: string[];
  hasProof: boolean;
  hasTension: boolean;
  isMonotonous: boolean;
  tip?: string;
}

export interface PrePublishChecklist {
  strongHook: boolean;
  clearOutcome: boolean;
  tensionPivot: boolean;
  concreteProof: boolean;
  conciseWords: boolean;
  variedCadence: boolean;
}

export interface AnalysisResult {
  sentences: SentenceAnalysis[];
  checklist: PrePublishChecklist;
  charCount: number;
  wordCount: number;
  readTimeSeconds: number;
  coachingChallenges: string[];
}

