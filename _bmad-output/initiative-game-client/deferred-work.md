- source_plan: none
  summary: Persistence and continuity — resume after reload, local high scores (incl. expired-game entries), and continuing a game via its link on another device (CAP-10, CAP-11, CAP-14; AD-12).
  evidence: Split from the full-spec build on 2026-10-01 by user choice; independently shippable on top of the core loop, which works without persistence.
- source_plan: none
  summary: Visual risk-reward cues and design assets — tier/urgency/reward-rank/affordability cues, self-hosted Fredoka/Nunito fonts, Lucide and game-icons.net icons with attribution, responsive polish verified at 360/1440 px (CAP-6, CAP-8 polish; AD-4 cue functions, AD-14).
  evidence: Split from the full-spec build on 2026-10-01 by user choice; the core loop is playable with plain text labels, cues layer on afterwards.
- source_plan: `_bmad-output/initiative-game-client/plan-iteration-a-game-screen-layout.md`
  summary: Reconcile AD-15 focus ownership. Route-change focus lives in App.afterEach, while after-turn focus lives in GameView.
  evidence: Conformance and a11y lenses. It works today because every screen has one h1, but the spine says GameView owns focus.
- source_plan: `_bmad-output/initiative-game-client/plan-iteration-a-game-screen-layout.md`
  summary: Intermittent unit-test failures where async work appears to leak across tests in game.spec.ts.
  evidence: Seen twice in about 40 runs (quick lens), cause unknown, maybe-false. Settle with repeated `--sequence.shuffle` runs at the baseline and at HEAD.
- source_plan: `_bmad-output/initiative-game-client/plan-iteration-a-game-screen-layout.md`
  summary: Check with a real screen reader that the focus move after a turn doesn't cut off the polite log announcement.
  evidence: a11y lens, maybe-false. VoiceOver can drop queued polite output on a focus change.
- source_plan: `_bmad-output/initiative-game-client/plan-iteration-a-game-screen-layout.md`
  summary: Pre-existing a11y gaps. index.html has lang="" and the title "Vite App" with no per-route titles; the loading role=status is inserted together with its content.
  evidence: a11y lens; SC 3.1.1, 2.4.2, 4.1.3.
- source_plan: none
  summary: Job row cue polish, to apply after B2 lands. Row order is gold, risk icon, label and win %, ad text, expiry. Gold icon tiers are crown-coin (under 100), coins (100–999) and open-treasure-chest by Skoll (1,000 and up), in a gold colour distinct from moderate amber; credits add Skoll. Expiry is coloured only: red at 1 turn, amber at 2–3.
  evidence: User decision 2026-10-05 from the gold-cues preview (variant B). Held back so it doesn't edit the same files as B2.
