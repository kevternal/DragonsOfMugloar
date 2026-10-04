- source_plan: none
  summary: Let the user trigger a reputation check from the keyboard while the NPC plays.
  evidence: User request 2026-10-04, deferred. The NPC tracks state locally from solved jobs (steal −2, infiltrate +2, investigate +1 [V]), and reads reputation every 25 turns for trend data.
- source_plan: `_bmad-output/initiative-game-backend/plan-backend-structure-refactor.md`
  summary: Add a Spring context test for `NpcConfig` that proves `spring.http.clients.*` (5 s connect, 10 s read, `simple` factory) reach `MugloarClient`'s request factory.
  evidence: Unverified (maybe-false, medium if true). Binding works per a jar run, but nothing asserts the factory type or timeouts. Settle it with an `ApplicationContextRunner` (or `@SpringBootTest` with the runner excluded) that inspects the built `RestClient`'s request factory.
