import { NextRequest, NextResponse } from 'next/server';
import { analyzeLocally } from '@/lib/heuristics';
import { AnalysisResult } from '@/lib/types';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a strict, constructive copywriting coach. Analyze the user's draft using the 6 Ps, 5 Cs, and But/Therefore frameworks.
NEVER rewrite the draft. Preserve their authentic voice.
Evaluate Sentence 1 using the Virality Formula: (Benefit * Relevance * Credibility) / Perceived Effort. Only pass "strong_hook" if it genuinely hooks (not a generic opener).
For "pitch" mode, also evaluate Priority (urgency / cost of inaction), CTA clarity (Who, What, When, How), whether the first 2 sentences show recipient-specific context (not a generic blast), and whether the draft leads with upfront value ("give_before_ask" boolean). Flag generic self-praise ("hard worker", "team player", "would love to connect", "pick your brain") as leaks.
For "blog" mode, check Educational (What, Why, How) or Narrative (But, Therefore) flow.
Return a strict JSON object with:
1) sentences: list of objects with "text", "role" ("hook" | "tension" | "resolution" | "proof" | "neutral"), "leaks" (array of strings), "tip" (short actionable tip)
2) checklist: object with booleans: "strong_hook", "clear_outcome_so_what", "but_therefore_tension", "concrete_proof", "concise_10_dollar_words", "varied_cadence", "has_cta", "has_urgency", "give_before_ask"
3) coaching_challenges: array of 1-3 high-impact Socratic editing challenges phrased as questions or constraints.
4) so_what_chain: array of 3-4 short strings drilling from the draft's main feature/claim down to its core emotional or business outcome (Save time, Make money, Reduce risk).`;

const SO_WHAT_PROMPT = `Extract the main feature or claim from the draft and run the "So What?" drill 4 levels deep until you hit the core emotional or business outcome (Save time, Make money, Reduce risk).
Return strict JSON: { "so_what_chain": ["Feature: ...", "So what? ...", "So what? ...", "Core Outcome: ..."] }`;

async function callLLM(
  groqKey: string | undefined,
  geminiKey: string | undefined,
  chosenModel: string | undefined,
  systemPrompt: string,
  userContent: string
): Promise<{ parsed?: any; source?: string; error?: string }> {
  if (groqKey) {
    try {
      const modelToUse = chosenModel || 'llama-3.1-70b-versatile';
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (!groqRes.ok) {
        const errData = await groqRes.json().catch(() => ({}));
        return { error: errData?.error?.message || `Groq API Error: ${groqRes.status} ${groqRes.statusText}` };
      }

      const groqData = await groqRes.json();
      const content = groqData.choices?.[0]?.message?.content;
      if (content) {
        return { parsed: JSON.parse(content), source: `groq (${modelToUse})` };
      }
    } catch (err: any) {
      return { error: err?.message || 'Failed connecting to Groq' };
    }
  }

  if (geminiKey) {
    try {
      const modelToUse = chosenModel || 'gemini-2.0-flash';
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
          })
        }
      );

      if (!geminiRes.ok) {
        const errData = await geminiRes.json().catch(() => ({}));
        return { error: errData?.error?.message || `Gemini API Error: ${geminiRes.status}` };
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return { parsed: JSON.parse(rawText), source: `gemini (${modelToUse})` };
      }
    } catch (err: any) {
      return { error: err?.message || 'Failed connecting to Gemini' };
    }
  }

  return {};
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text || '';
    const mode = body.mode || 'x';
    const action = body.action || 'audit';
    const clientKey: string | undefined = body.apiKey?.trim();
    const chosenModel: string | undefined = body.model?.trim();

    const groqKey = (clientKey && clientKey.startsWith('gsk_')) ? clientKey : process.env.GROQ_API_KEY;
    const geminiKey = (clientKey && !clientKey.startsWith('gsk_')) ? clientKey : process.env.GEMINI_API_KEY;

    const localResult: AnalysisResult = analyzeLocally(text, mode);

    if (!text.trim()) {
      return NextResponse.json({ ...localResult, source: 'local' });
    }

    if (action === 'so_what') {
      const llm = await callLLM(groqKey, geminiKey, chosenModel, SO_WHAT_PROMPT, `Draft:\n${text}`);
      if (llm.error) {
        return NextResponse.json({ apiError: llm.error });
      }
      if (llm.parsed?.so_what_chain) {
        return NextResponse.json({ soWhatChain: llm.parsed.so_what_chain, source: llm.source });
      }
      // Deterministic Socratic fallback when no API key is set
      const claim = localResult.sentences[0]?.text || text.slice(0, 80);
      return NextResponse.json({
        soWhatChain: [
          `Claim: "${claim}"`,
          'So what? What friction or bottleneck disappears for the reader?',
          'So what? How does that save them time, make money, or cut risk?',
          'Core Outcome: Rewrite your payoff around that concrete transformation.'
        ],
        source: 'local'
      });
    }

    const llm = await callLLM(
      groqKey,
      geminiKey,
      chosenModel,
      SYSTEM_PROMPT,
      `Mode: ${mode}\n\nDraft:\n${text}`
    );

    if (llm.error) {
      return NextResponse.json({ ...localResult, source: 'local', apiError: llm.error });
    }

    if (llm.parsed && llm.source) {
      return NextResponse.json(mergeResults(localResult, llm.parsed, llm.source, mode));
    }

    return NextResponse.json({
      ...localResult,
      source: 'local',
      apiNotice: 'Heuristic audit only. Set a Groq or Gemini key for deep AI coaching.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

function mergeResults(localResult: AnalysisResult, parsed: any, source: string, mode: string) {
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
      variedCadence: typeof aiChecklist.varied_cadence === 'boolean' ? aiChecklist.varied_cadence : localResult.checklist.variedCadence,
      ...(mode === 'pitch'
        ? {
            hasCta: typeof aiChecklist.has_cta === 'boolean' ? aiChecklist.has_cta : localResult.checklist.hasCta,
            hasUrgency: typeof aiChecklist.has_urgency === 'boolean' ? aiChecklist.has_urgency : localResult.checklist.hasUrgency,
            giveBeforeAsk: typeof aiChecklist.give_before_ask === 'boolean' ? aiChecklist.give_before_ask : localResult.checklist.giveBeforeAsk,
          }
        : {}),
    },
    charCount: localResult.charCount,
    wordCount: localResult.wordCount,
    readTimeSeconds: localResult.readTimeSeconds,
    readingGrade: localResult.readingGrade,
    coachingChallenges: parsed.coaching_challenges?.length ? parsed.coaching_challenges : localResult.coachingChallenges,
    soWhatChain: parsed.so_what_chain?.length ? parsed.so_what_chain : undefined,
    source
  };
}
