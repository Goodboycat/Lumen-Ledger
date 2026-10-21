# Lumen Ledger — Game Budget (Zoud GameLab jam deliverable, Chat 13A)
*Required by the jam for entries that want to be considered for development funding ("Your Game · Concept Doc · 2‑Minute Video · Game Budget").*
*Two columns throughout: **A — the jam build** (what actually exists on 2026‑11‑15, costed honestly) and **B — the funded v1.0** (12 months to a polished, localised, store‑ready release on web + Android + iOS). All figures USD, rounded; rates are mid‑range indie/contract rates for a remote team. Replace the bracketed items with real names before submission.*

## 0. Summary
| | A · Jam build (Oct 15 → Nov 15 2026) | B · Funded v1.0 (12 months) |
|---|---|---|
| Calendar | 1 month (4.5 weeks) | 12 months (3 milestones) |
| Team | 1 director + AI chat pipeline (~40 × 100‑credit sessions) | 4.5 FTE core + 6 contract roles |
| Total people cost | **$6,900** (imputed) | **$517,000** |
| Tools, services, audio, QA, legal | **$485** | **$49,600** |
| Marketing & release | **$0** | **$62,500** |
| Contingency (12 %) | — | **$75,500** |
| **Total** | **≈ $7,400** | **≈ $705,000** |
| Ask (if funded) | — | **$705,000** full v1.0, or **$260,000** "v0.9" tier (§7) |

## 1. Scope being budgeted
**A (exists):** 10‑season story run (~25 min) on one three‑zone island · 12 stalls × 3 levels · 12 Glimmer customer types · 6 helper creatures · Baron Gilt + 3 Fog Collectors · 9 hero moves + 6 FinLit abilities · 4‑jar economy with loans/interest/invest/protect · 10 events · 6 scams with tells · 10 lesson cards · Ledger Review with 0–3 stars · title/pause/settings/touch UI · localStorage save · tutorial toasts · procedural synth audio with a 39‑event sound map · itch.io HTML5 build · Flutter WebView APK · GDD · 2‑min trailer.
**B (funded):** everything in A, plus: 30 seasons across 3 islands (3 FinLit "curricula": kids 8–12 · teens · young adults, each 10 lessons), 24 stalls, co‑op "household" mode (2 players share jars), teacher/parent dashboard (classroom codes, progress export), 6 languages incl. Arabic (RTL UI), recorded voice barks, licensed music, accessibility audit (WCAG 2.2 AA), native Android/iOS wrappers with store compliance, telemetry + learning‑outcome study with a partner school, live‑ops calendar (seasonal events) for 6 months post‑launch.

## 2. Schedule
### A · Jam (actual)
| Week | Dates | What shipped |
|---|---|---|
| 0 | Sep 15 – Oct 14 (prep) | Design bible, API contracts, master plan, chat pipeline + headless test harness |
| 1 | Oct 15 – 21 | Foundation (loop, toon/outline, sequencer), 12 stalls, nature, landmarks, decor, 22 creatures |
| 2 | Oct 22 – 28 | Hero moves/abilities, economy core + balance, build system, customer AI, UI (HUD, jars, ledger, dialogue, title, touch), story data + system, VFX |
| 3 | Oct 29 – Nov 4 | Integration (world, systems, UI/story state machine), save/tutorial, perf pass, mobile QA, audio |
| 4 | Nov 5 – 13 | Jam package (this), trailer, APK, buffer; **submit Nov 13** (deadline Nov 15) |

### B · Funded v1.0 (12 months from funding)
| Milestone | Months | Exit criteria |
|---|---|---|
| M1 — Vertical slice+ | 1–3 | Island 2 playable, co‑op prototype, Arabic RTL UI, telemetry live, 2 pilot classrooms |
| M2 — Content complete | 4–8 | 30 seasons, 24 stalls, all 3 curricula, voice + licensed music, dashboard beta, 6 languages in |
| M3 — Polish & release | 9–12 | WCAG audit passed, store submissions (Google Play, App Store), learning‑outcome report, launch + 3 months live‑ops funded |

## 3. People
### A · Jam build (imputed — nobody was paid; shown so the sheet is comparable)
| Role | Who | Effort | Rate | Cost |
|---|---|---|---|---|
| Director / designer / integrator | [name] | ~60 h (prep, prompts, reviews, QA, submission) | $60/h | $3,600 |
| Design · code · art · writing | LUMEN chat pipeline (Genspark), ~40 sessions × 100 credits | 4,000 credits ≈ $400 of subscription | — | $400 |
| Review / playtest | 3 friends & family, 2 sessions each | 12 h | $0 (imputed $25/h → $300) | $300 |
| Flutter APK build (Chat 14) | [name] | 8 h | $60/h | $480 |
| Trailer capture + edit (13B) | [name] | 6 h | $60/h | $360 |
| Buffer / fixes week 4 | [name] | 24 h | $60/h | $1,440 |
| Contingency on imputed time | — | — | — | $320 |
| **People A** | | ~110 h | | **$6,900** |

### B · Funded v1.0 (12 months)
| Role | FTE | Months | Monthly | Cost | Notes |
|---|---|---|---|---|---|
| Game director / lead designer | 1.0 | 12 | $9,000 | $108,000 | owns curriculum mapping, balance, production |
| Gameplay engineer (Three.js / web) | 1.0 | 12 | $8,500 | $102,000 | economy, build, AI, perf; current codebase |
| Engineer #2 (dashboard, wrappers, telemetry) | 1.0 | 12 | $8,000 | $96,000 | teacher dashboard, Flutter/Capacitor, analytics |
| 3D / tech artist (procedural toon, VFX, UI) | 1.0 | 12 | $7,000 | $84,000 | 12 new stalls, 2 islands, UI skin, marketing art |
| Writer / FinLit curriculum designer | 0.5 | 12 | $7,000 | $42,000 | 20 new seasons, 3 curricula, lesson cards |
| QA lead (contract, M2–M3) | 0.5 | 6 | $6,000 | $18,000 | device matrix, regression, accessibility |
| Composer + sound designer (contract) | — | — | fixed | $18,000 | 6 music loops + 40 SFX, stems, mix |
| Voice actors, 5 roles (contract) | — | — | fixed | $9,000 | barks + narration, 2 languages |
| Localisation, 6 languages × ~9k words | — | — | fixed | $16,000 | EN·AR·FR·ES·HI·UR, RTL QA included |
| Learning scientist / study partner | — | — | fixed | $24,000 | pre/post study with 2 pilot schools, report |
| **People B** | **4.5 FTE** | | | **$517,000** | |

## 4. Tools & services
| Item | A · Jam | B · 12 months | Notes |
|---|---|---|---|
| Engine / libraries | $0 | $0 | Three.js r160 (MIT), vanilla ES modules — no licence cost |
| AI pipeline (Genspark credits) | $400 (in §3) | $4,800 | $400/mo for prototyping and content drafts |
| Audio generation (Ludo.ai or similar) | $30 | $360 | 1 month vs 12 months; replaced by the composer in M2 |
| Hosting (itch.io, GitHub) | $0 | $0 | itch is free; GitHub free tier |
| Backend for dashboard/telemetry | $0 | $7,200 | Cloudflare Workers + D1 ($600/mo at pilot scale) |
| Developer accounts (Google Play $25 once, Apple $99/yr) | $25 | $124 | |
| Devices for QA (2 low‑end Android, 1 iPad, 1 iPhone) | $0 (own phones) | $2,100 | 2018‑class Android is the perf target |
| Design/asset tools (Figma, Aseprite, DaVinci) | $0 | $1,200 | |
| Project management / comms | $0 | $600 | |
| Legal (privacy policy, COPPA/GDPR review, school data agreements) | $0 | $9,000 | mandatory before classroom pilots |
| Accessibility audit (WCAG 2.2 AA, external) | $0 | $6,500 | |
| Insurance / accounting | $0 | $4,800 | |
| **Tools & services** | **$455** | **$36,684** → rounded **$36,700** | |

## 5. Audio
| Item | A · Jam | B · 12 months |
|---|---|---|
| Approach | Procedural WebAudio synth (11 sketch types + chord‑pad music) built into the engine; 39 bus events mapped; optional Ludo.ai .ogg drop‑in (`docs/audio_prompts.md`) | Composer: 6 adaptive loops (title, 3 islands, endless, victory) + 40 SFX; VO barks; licensed mix |
| Cost | $30 (Ludo.ai month) | $18,000 (people §3) + $9,000 VO (§3) + $800 licensing/mastering tools |
| **Audio line (excl. people already in §3)** | **$30** | **$800** |

## 6. QA, playtesting & learning validation
| Item | A · Jam | B · 12 months |
|---|---|---|
| Automated | `tools/check.mjs` headless suite (~5 s, 15 sections, runs every commit) · `tools/qa_mobile.mjs` Playwright 3 viewports | same + CI on every PR, device farm (BrowserStack $2,400/yr) |
| Manual | 6 friends‑and‑family sessions (imputed $300, §3) | 3 external playtest rounds × 12 testers × $40 = $1,440 ×3 = $4,300; QA lead (§3) |
| Learning outcomes | none (self‑report in Ledger stars) | pre/post FinLit quiz in 2 pilot schools, n≈120 (learning scientist §3) + $3,000 participant incentives + $1,500 ethics/consent admin |
| Accessibility | in‑house checklist (reduce‑motion, 44 px, colour+icon+text) | external WCAG audit (§4) + 6 testers with disabilities × $150 = $900 |
| **QA line (excl. people)** | **$300** (in §3) | **$12,100** |

## 7. Marketing & release
| Item | A · Jam | B · 12 months |
|---|---|---|
| Store pages (itch, Google Play, App Store) | $0 — itch page copy in `docs/ITCH_PAGE.md` | $3,500 (key art, 6 localised store listings, ASO) |
| Trailer | $360 (13B, in §3) | $8,000 (2 trailers: launch 60 s + education 2 min, pro edit) |
| Press / influencer / education outreach | $0 | $12,000 (edu‑tech press kit, 4 teacher conferences, 10 creators) |
| Launch event / jam showcase travel | $0 | $6,000 |
| Paid UA test (education + family) | $0 | $15,000 |
| Community (Discord, newsletter, live‑ops calendar 6 months) | $0 | $18,000 (0.5 community manager, contract) |
| **Marketing & release** | **$0** | **$62,500** |

### Totals (B): people 517,000 + tools & services 36,700 + audio 800 + QA 12,100 + marketing 62,500 = **629,100** → contingency 12 % **75,500** → **≈ $705,000**. (The §0 summary carries this number.)

### Funding tiers (if partial)
| Tier | Ask | What it buys |
|---|---|---|
| **v0.9 "Classroom pilot"** | **$260,000** | 6 months · director + 1 engineer + 0.5 artist + 0.5 writer · island 2 (teen curriculum, 10 seasons) · Arabic + English · teacher dashboard beta · 2 pilot classrooms with a learning‑outcome report · web + Android |
| **v1.0 "Full"** | **$705,000** | everything in §1 B over 12 months |
| **v1.0 + 12 months live‑ops** | **$830,000** | + seasonal events, 2 more languages, iOS feature push, second study cohort |

### Assumptions & risks
- Rates: remote mid‑level contract rates (MENA/EU blended); on‑site UAE salaries would add ~25 %.
- The codebase is engine‑free and dependency‑free (one MIT library), so there is no licence or tooling cliff when scaling.
- Largest risk is **content volume** (20 more seasons × 20 lines + lessons) — mitigated by the existing data‑driven story system (`data/story.json`, pure JS, headless‑tested) and the AI drafting pipeline (+$4,800 in §4).
- Second risk is **school data compliance** — budgeted legal ($9,000) and a privacy‑by‑default design (no accounts needed to play; classroom codes only in the dashboard).
