# SUGGESTIONS — bigger ideas (NOT implemented; discuss before coding)

| ID | Idea | Why (evidence) |
|----|------|----------------|
| S01 | Season-1 balance pass: lower S1 Baron interest (or start debt 260 → ~180), or give 1 extra starter sale/15 s. | Recording run 2 (`LUMEN_extras/recordings/play_2026-10-22-00-11.*`): S1 income 66 vs expenses 221 (interest 52, upkeep 49) → debt grew 260→315 and the pouch hit 0 even while buying only 1 stall. A first-time kid loses ground in the tutorial season. |
| S02 | Raise `Game.maxDt` from 1/20 to 1/10 (or sub-step economy at fixed dt) so seasons keep wall-clock length on weak phones. | P06: below 20 fps everything (seasons, customers) slows down proportionally. |
| S03 | Auto-APPLY option ("pay yourself first"): a toggle on the jars panel that splits every sale by the sliders automatically. | Teaches the real habit; removes the most common "jars stay empty" failure seen in recordings. |
| S04 | Recorder: also capture the DOM HUD by compositing a 2D canvas (html snapshot of HUD values drawn as text over the WebGL frame). | Current webm is canvas-only; HUD/jars/dialogue live in the timeline JSON instead. |
| S05 | "Pay Baron" quick button in the HUD debt chip (the jars panel is collapsed on phones during dialogue). | Repay is the core win path (B01) but sits at the bottom of the jars panel. |
