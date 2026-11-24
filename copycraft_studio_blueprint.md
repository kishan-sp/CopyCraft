# CopyCraft Studio: AI-Guided Writing & Visual Storytelling App

## 1. Product Vision & Core Philosophy
**CopyCraft Studio** is a distraction-free, frontend web application designed to act as a **personal writing coach**, not a ghostwriter. Instead of generating generic AI slop, it evaluates your rough drafts against proven copywriting frameworks, highlights the structural flow of your sentences using color-coding, and guides you with targeted Socratic questions to polish your own voice.

### Core Design Principles
* **Coach, Don't Rewrite:** The LLM API is strictly prompted to audit, ask guiding questions, and point out leaks—never to overwrite your authentic human touch.
* **Visual Storytelling Architecture:** Sentences are highlighted dynamically so you can *see* the rhythm, tension, and narrative arc of your writing at a glance.
* **Context-Aware Modes:** Switch between **Daily X Post** (280-char counter + hook/punchline check), **Weekly Blog** (long-form narrative + contrarian thesis), and **Job Pitch / Resume** (outcome & metric verification).

---

## 2. Core Features & User Interface

### A. The Split-Screen Editor
1. **Left Pane (The Canvas):**
   * Clean Markdown/plain-text editor with live character and word counters (including a hard 280-character visual indicator for X posts).
   * **Visual Storytelling Overlay Toggle:** Turns on sentence-level color coding directly over your text.
   * **Cadence Meter:** Visually flags if 3+ consecutive sentences have the exact same length (preventing monotonous rhythm).
2. **Right Pane (The Copy Coach & Checklist):**
   * **Interactive Pre-Publish Checklist:** Dynamic pass/fail badges powered by lightweight heuristics + LLM evaluation.
   * **Socratic Audit Feed:** Displays 1–3 high-impact fixes phrased as actionable challenges (e.g., *"You repeated 'get work done' twice—cut 30% of Sentence 2 without losing meaning"*).

---

## 3. Visual Storytelling Color-Coding System
When the **Storytelling Lens** is active, the LLM classifies each sentence into its narrative role and renders a subtle background highlight in the editor:

| Color | Role / Framework Element | What It Represents |
| :--- | :--- | :--- |
| 🟦 **Blue** | **Hook / Context / "What"** | The opening claim, concrete fact, or status quo (*"Everyone thinks X..."* or *"I trained a tiny model..."*). |
| 🟨 **Yellow** | **Tension / "But" / Pain** | The obstacle, contrarian twist, or why current solutions fail (*"But I hit a wall: signs change from street to street."*). |
| 🟩 **Green** | **Resolution / "Therefore" / Promise** | The core outcome, insight, or solution (*"Scaling one model is nearly impossible—that's the real bottleneck."*). |
| 🟪 **Purple** | **Concrete Proof ("Deaf & Mute" Test)** | Hard numbers, metrics, tools, or undeniable real-world details (*">90% accuracy", "100K images", "without cloud GPUs"*). |
| 🟥 **Red (Wavy Underline)** | **Copy Leak ($10 Word Violation)** | Filler words, robotic jargon, passive voice, or repeated phrases that dilute clarity. |

*Visual Diagnostic Rule:* If a draft is all Blue and has zero Yellow or Green, the app alerts you: **"Your story is linear (And then... And then...). Add a 'But' to create tension."**

---

## 4. Complete Copywriting Knowledge Base (Embedded into App Logic)

Every audit and checklist item in the app is derived from these foundational copywriting lessons:

### Part I: The 6 Ps of Copy Thinking
1. **People (Target Avatar)**
   * Define who is reading (e.g., AI/ML hiring managers, startup founders, fellow engineers).
   * Use their exact vocabulary (e.g., write `100K` instead of `1 lakh` for global tech audiences).
   * *Rule:* If you describe their pain points better than they can, they subconsciously trust you have the solution.
2. **Positioning**
   * How your work is perceived in the reader's mind.
   * Marketing is creating conditions for others to eagerly spread your ideas.
3. **Promise & The "So What?" Test**
   * Focus on the **core outcome** (who they become / what problem disappears), not just features.
   * **The "So What?" Drill:** Take any technical feature and ask *"So what?"* 3–5 times until you hit an emotional or functional business outcome (Save time, Make money, Reduce risk).
   * *Formula:* `IF YOU CONFUSE, YOU LOSE.`
4. **Proof (The "Deaf & Mute" Test)**
   * Trust is belief with evidence.
   * **The Deaf & Mute Test:** If you couldn't speak or make claims, what tangible artifacts could you point to? (GitHub repos, accuracy metrics, dataset size, latency numbers, logos, live demos).
5. **Priority (Why Act Now?)**
   * People jog toward pleasure, but they **sprint away from pain**.
   * Highlight urgency, scarcity, or the **cost of inaction** (what happens if they ignore the problem).
6. **Process (The Contrarian Offer)**
   * A compelling angle explains why other solutions fail, creates a believable path, feels different, and is easy to understand.
   * **The Contrarian Template:**
     * *Everyone thinks [X]...*
     * *They are wrong because [Y]...*
     * *What I believe/build instead is [Z].*

---

### Part II: The 5 Cs of Writing (Editing Rules)
1. **Clear (The Fire Fighter Test)**
   * If you had to warn someone of danger, would your message be instant and direct? Eliminate ambiguity and sentence fragments.
2. **Concise (The $10-Per-Word Rule)**
   * Treat every word as if it costs $10.
   * Ask: *"What can I cut without removing quality or understanding?"*
3. **Concrete**
   * Write so the reader can visualize the scene (*"signs change from street to street"* instead of *"lack of dataset generalization"*).
4. **Conversational**
   * Write like a smart human talking to a peer. Strip out stiff academic or corporate buzzwords.
5. **Cadence**
   * Vary sentence lengths like music. Follow a long, descriptive sentence with a short, punchy 4-to-6-word sentence. Always read drafts out loud.

---

### Part III: Structural Frameworks (Hooks, Bodies, CTAs)
* **The Virality Formula:**
  $$\text{Virality} = \frac{\text{Benefit} \times \text{Relevance} \times \text{Credibility}}{\text{Perceived Effort}}$$
* **Body Framework 1 — Educational (What, Why, How):**
  1. **What:** The core point or discovery.
  2. **Why:** Why the reader should care (the "So What?" outcome).
  3. **How:** One actionable takeaway or technical insight.
* **Body Framework 2 — Narrative (But, Therefore):**
  * Never write flat, chronological lists (*"I did A, and then B, and then C"*).
  * Connect beats using **But** (conflict/complication) and **Therefore** (consequence/pivot).
* **Value Creation Pillars:** Every professional pitch or resume bullet must clearly tie back to:
  1. Saving people time
  2. Making them more money / cutting costs
  3. Reducing their risk

---

## 5. Interactive Pre-Publish Checklist Logic

Before hitting "Copy & Export," the app evaluates the draft against this 6-point checklist:

- [ ] **1. The Hook Check:** Does the first sentence deliver immediate Benefit, Credibility, or a Contrarian take?
- [ ] **2. The "So What?" Check:** Does the piece state a clear outcome rather than just listing technical features?
- [ ] **3. The "But / Therefore" Check:** Is there at least one point of tension or narrative pivot (no flat linear storytelling)?
- [ ] **4. The Deaf & Mute Proof Check:** Is there at least one concrete number, visual detail, or verifiable artifact?
- [ ] **5. The $10 Word Check:** Are at least 15–20% of filler/repeated words trimmed from the first draft?
- [ ] **6. The Cadence & Fire Fighter Check:** Are sentence lengths varied, and is every sentence clear on the first read?

---

## 6. Suggested Frontend Tech Stack & LLM Prompt Architecture

### Recommended Stack (Fast MVP)
* **Framework:** React (Next.js or Vite) + Tailwind CSS
* **Editor Component:** `Tiptap` or custom `contentEditable` / mirrored `<textarea>` overlay for real-time sentence background highlighting.
* **LLM Integration:** OpenAI / Gemini / Anthropic API returning **Structured JSON** so the frontend can deterministically render highlights and checklist states.

### System Prompt Template for the LLM API
```json
{
  "system_instruction": "You are a strict, constructive writing coach. Analyze the user's draft using the 6 Ps, 5 Cs, and But/Therefore frameworks. NEVER rewrite the user's entire draft. Preserve their authentic voice. Return a JSON object containing: 1) sentence-by-sentence classifications ('hook', 'tension', 'resolution', 'proof', 'leak') with exact substring matches, 2) pass/fail booleans for the 6 checklist items, and 3) up to 3 Socratic editing challenges.",
  "response_schema": {
    "sentences": [
      {
        "text": "Exact sentence from draft",
        "role": "hook | tension | resolution | proof | neutral",
        "leaks": ["repeated phrase", "robotic jargon"],
        "tip": "Optional concise coaching note"
      }
    ],
    "checklist": {
      "strong_hook": true,
      "clear_outcome_so_what": false,
      "but_therefore_tension": true,
      "concrete_proof": true,
      "concise_10_dollar_words": false,
      "varied_cadence": true
    },
    "coaching_challenges": [
      "Challenge 1 phrased as a question or tight constraint..."
    ]
  }
}
```

---

## 7. Build Roadmap (Practice in Public)
1. **Phase 1 (Weekend MVP):** Single-page editor with mode selector (`X Post`, `Blog`, `Resume Bullet`), character counter, and one "Audit Draft" button connected to your LLM API key.
2. **Phase 2 (Visual Storytelling Lens):** Add the color-coded sentence highlighter (`Blue`, `Yellow`, `Green`, `Purple`, `Red`) and a visual bar showing the ratio of Hook vs. Tension vs. Resolution.
3. **Phase 3 (V1 -> V2 Diff & Streak Tracker):** Store draft revisions locally (`localStorage`) so you can compare your V1 raw brain-dump against your V2 polished post—and share your "before & after" progress publicly on X.