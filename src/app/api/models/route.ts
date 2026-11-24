import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey?.trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // 1. Groq Provider
    if (apiKey.startsWith('gsk_')) {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: err?.error?.message || `Groq error: ${res.status} ${res.statusText}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const models: string[] = (data.data || [])
        .filter((m: any) => m.active !== false && !m.id?.includes('whisper'))
        .map((m: any) => m.id);

      return NextResponse.json({ models, provider: 'groq' });
    }

    // 2. Gemini Provider
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error?.message || `Gemini error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const models: string[] = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace(/^models\//, ''));

    return NextResponse.json({ models, provider: 'gemini' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed fetching models' },
      { status: 500 }
    );
  }
}
