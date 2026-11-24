# CopyCraft Checklist Scoring & Passing Criteria

This document details how each of the 6 items in the **Pre-Publish Checklist** is calculated, its heuristic thresholds, and passing criteria.

---

| Checklist Item | What It Checks | Passing Mark (Instant Heuristic) | Deep AI Coach Criteria |
| :--- | :--- | :--- | :--- |
| **1. Hook punchiness** | Opening grab | Opening sentence $\le 25$ words | Checks that sentence 1 delivers an immediate contrarian claim, benefit, or curiosity hook rather than a slow intro. |
| **2. Clear outcome ("So What?")** | Tangible payoff | Contains outcome terms (`save`, `cut`, `make`, `boost`, `revenue`, `scale`, `speed`, `reduce`, `profit`, `hire`) or `pitch` mode with $>10$ words | Verifies the draft passes the "So What?" drill: solves a problem, saves time, cuts costs, or reduces risk. |
| **3. Tension / Conflict beat** | Narrative friction | Contains at least 1 tension marker (`but`, `however`, `yet`, `instead`, `bottleneck`, `wall`, `failed`, `flaw`, `problem`) | Ensures the piece is not a flat chronological list ("and then..."). Requires at least one complication or obstacle. |
| **4. Concrete proof (Deaf & Mute)** | Verifiable evidence | Contains numbers, metrics, or links (`94.2%`, `100K`, `60%`, `$12K`, `ms`, `users`, `github.com`) | Verifies tangible artifacts that pass the "Deaf & Mute" test: data you can point to without speaking claims. |
| **5. No $10-word copy leaks** | Word economy | Total detected copy leak count $= 0$ | Evaluates that filler adverbs (*literally, basically, very*), wordy phrases (*in order to* $\to$ *to*), and passive voice are trimmed. |
| **6. Varied sentence cadence** | Musical rhythm | Draft has $>1$ sentence AND zero 3+ consecutive sentences with identical word count | Flags monotonous cadence. Checks that sentence lengths expand and contract (e.g. 14w $\to$ 22w $\to$ 6w). |

---

### Detailed Calculation Rules

#### 1. Hook Punchiness (`strongHook`)
* **Logic:** `analyzedSentences[0].wordCount <= 25 && !isBlank`
* **Why:** Readers decide within the first sentence whether to keep reading or scroll. Overly long compound sentences fail to hook attention.

#### 2. Clear Outcome ("So What?") (`clearOutcome`)
* **Logic:** Regex match against business and personal payoff keywords:
  ```regex
  \b(save|saving|make|making|cut|cutting|reduce|reducing|boost|growth|revenue|profit|scale|convert|speed|hire|landed)\b
  ```
* **Why:** Readers care about what changes for *them* (Save time, Make money, Reduce risk), not technical feature lists.

#### 3. Tension / Conflict Beat (`tensionPivot`)
* **Logic:** Regex match against contrast conjunctions and obstacle markers:
  ```regex
  \b(but|however|yet|although|though|instead|except|whereas|nevertheless|bottleneck|wall|failed|flaw|problem|conflict|trap|mistake)\b
  ```
* **Why:** Stories without tension are boring. A "But" creates the curiosity gap that pulls the reader to the resolution.

#### 4. Concrete Proof (`concreteProof`)
* **Logic:** Regex detection of verifiable numbers, symbols, metric units, and repository/demo links:
  ```regex
  (\b\d+(\.\d+)?%|\$\d+(\.\d+)?|\b\d+[kKmMbB]\b|\b\d+\s*(images|users|ms|seconds|minutes|hours|days|x|fold|accuracy|latency|lines|repos|stars|downloads|clients)\b|https?:\/\/\S+|\b(github|gitlab|figma)\.com\S*)
  ```
* **Why:** Specific numbers are memorable and believable; general adjectives are easily dismissed.

#### 5. No $10-Word Copy Leaks (`conciseWords`)
* **Logic:** Scan against corporate jargon, wordy filler phrases, and passive constructions:
  * `"in order to"` $\to$ use `"to"`
  * `"due to the fact that"` $\to$ use `"because"`
  * `"for the purpose of"` $\to$ use `"to"`
  * Clichés: `"at the end of the day"`, `"needless to say"`
  * Empty adverbs: `basically`, `literally`, `actually`, `really`, `very`
  * Buzzwords: `synergy`, `utilize`, `leverage`, `bandwidth`
  * Passive voice: `(is|are|was|were|been|being) + verb + by`
* **Passing Mark:** Strict $0$ detected leaks.

#### 6. Varied Sentence Cadence (`variedCadence`)
* **Logic:** Computes word length for every sentence. If 3 or more consecutive sentences have the exact same length (e.g. 12 words $\to$ 12 words $\to$ 12 words), it triggers a cadence monotony warning and fails the check.
* **Passing Mark:** At least 2 sentences present, and no flat 3-sentence streaks.
