import { NextRequest, NextResponse } from 'next/server';
import { analyzeLocally } from '@/lib/heuristics';
import { AnalysisResult } from '@/lib/types';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a strict, constructive copywriting coach. Analyze the user's draft using the 6 Ps, 5 Cs, and But/Therefore frameworks. 
NEVER rewrite the draft. Preserve their authentic voice. 
Return a strict JSON object with:
1) sentences: list of objects with "text", "role" (one of: "hook", "tension", "resolution", "proof", "neutral"), "leaks" (array of strings), "tip" (short string)
2) checklist: object with booleans: "strong_hook", "clear_outcome_so_what", "but_therefore_tension", "concrete_proof", "concise_10_dollar_words", "varied_cadence"
3) coaching_challenges: array of 1-3 high-impact Socratic editing challenges phrased as questions or constraints.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text || '';
    const mode = body.mode || 'x';
    const clientKey: string | undefined = body.apiKey?.trim();

    // Support Groq or Gemini keys
    const groqKey = (clientKey && clientKey.startsWith('gsk_')) ? clientKey : process.env.GROQ_API_KEY;
    const geminiKey = (clientKey && !clientKey.startsWith('gsk_')) ? clientKey : process.env.GEMINI_API_KEY;

    const localResult: AnalysisResult = analyzeLocally(text, mode);

    if (!text.trim()) {
      return NextResponse.json({ ...localResult, source: 'local' });
    }

    // 1. If Groq Key is available (fastest)
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Mode: ${mode}\n\nDraft:\n${text}` }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2
          })
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return NextResponse.json(mergeResults(localResult, parsed, 'groq'));
          }
        }
      } catch {
        // Fall through to Gemini or local
      }
    }

    // 2. If Gemini Key is available
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `Mode: ${mode}\n\nDraft:\n${text}` }] }],
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return NextResponse.json(mergeResults(localResult, parsed, 'gemini'));
          }
        }
      } catch {
        // Fall through to local
      }
    }

    // 3. Fallback to local heuristics
    return NextResponse.json({ ...localResult, source: 'local' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

function mergeResults(localResult: AnalysisResult, parsed: any, source: string) {
  const aiSentences = parsed.sentences || [];
  const mergedSentences = localResult.sentences.map((localS, idx) => {
    const match = aiSentences[idx] || aiSentences.find((s: any) => s.text?.trim() === localS.text.trim());
    if (match) {
      return {
        ...localS,
        role: match.role || localS.role,
        leaks: Array.from(new Set([...localS.leaks, ...(match.leaks || [])])),
        tip: match.tip || localS.tip
      };
    }
    return localS;
  });

  const aiChecklist = parsed.checklist || {};

  return {
    sentences: mergedSentences,
    checklist: {
      strongHook: typeof aiChecklist.strong_hook === 'boolean' ? aiChecklist.strong_hook : localResult.checklist.strongHook,
      clearOutcome: typeof aiChecklist.clear_outcome_so_what === 'boolean' ? aiChecklist.clear_outcome_so_what : localResult.checklist.clearOutcome,
      tensionPivot: typeof aiChecklist.but_therefore_tension === 'boolean' ? aiChecklist.but_therefore_tension : localResult.checklist.tensionPivot,
      concreteProof: typeof aiChecklist.concrete_proof === 'boolean' ? aiChecklist.concrete_proof : localResult.checklist.concreteProof,
      conciseWords: typeof aiChecklist.concise_10_dollar_words === 'boolean' ? aiChecklist.concise_10_dollar_words : localResult.checklist.conciseWords,
      variedCadence: typeof aiChecklist.varied_cadence === 'boolean' ? aiChecklist.varied_cadence : localResult.checklist.variedCadence
    },
    charCount: localResult.charCount,
    wordCount: localResult.wordCount,
    readTimeSeconds: localResult.readTimeSeconds,
    coachingChallenges: parsed.coaching_challenges?.length ? parsed.coaching_challenges : localResult.coachingChallenges,
    source
  };
}
