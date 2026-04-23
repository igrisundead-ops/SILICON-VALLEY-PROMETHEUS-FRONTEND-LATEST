# PROMETHEUS UX Notes

This repo now includes UI + mock logic scaffolding for a premium video editing workflow (no paid API integrations).

## Navigation + Routes

Left sidebar (`components/dashboard-sidebar.tsx`) now matches the PROMETHEUS sitemap:

- Workspace: Overview (`/`), Projects (`/projects`), Editor (`/editor`), Exports (`/exports`)
- Intelligence: Captions Studio (`/captions`), Auto Highlights (`/highlights`), B-roll Finder (`/broll`)
- Library: Templates (`/templates`), Assets (`/assets`), Brand Kit (`/brand-kit`)
- Business: Usage & Billing (`/billing`), Team (`/team`), Settings (`/settings`)

Required dynamic routes:

- Editor: `/editor/[id]`
- Exports: `/exports/[id]`

## Home (Overview) Workflow

The Overview page (`app/page.tsx`) renders `components/video-upload-interface.tsx`, which now supports:

- **Add Source** (link icon): modal with tabs (Link / Upload / Integrations / Brand Kit / References)
- **Templates & Styles** (grid icon): right-side drawer to set an active style (persisted)
- **Mock processing pipeline** (Send): creates a project and starts a deterministic multi-step job
- **Processing panel**: collapsible “tasks” UI using `components/ui/agent-plan.tsx` + shimmer status text
- **Open Editor CTA**: appears when the mock job completes

## Domain Model + Mock Pipeline

Types live in `lib/types/index.ts`.

Mock API + state machine:

- `lib/mock/index.ts`
  - `createProject()`
  - `createProcessingJob()`
  - `startProcessing()`
  - `getJobStatus()` (deterministic progression based on elapsed time)
- `lib/mock/styles.ts` provides the style library used by Templates + Home.

The processing artifacts are generated deterministically per project id:

- transcript segments
- detected scenes
- highlights
- b-roll suggestions

## LocalStorage Keys

The UI uses localStorage only (no backend):

- `prometheus.projects.v1` — project list
- `prometheus.jobsByProjectId.v1` — jobs keyed by project id
- `prometheus.activeStyleId.v1` — active template style id
- `prometheus.savedStyles.v1` — saved template favorites
- `prometheus.assets.v1` — uploaded asset list (mock)

## Extending Later

To extend the pipeline beyond UI mocks:

1. Keep `ProcessingJob` and `PipelineStep` stable; add new step keys and durations in `lib/mock/index.ts`.
2. Replace `getJobStatus()` with server-backed polling or SSE/WebSocket updates.
3. Swap placeholder preview + timeline rendering in `/editor/[id]` with a real player/timeline library.
4. Keep all paid integrations behind optional adapters (Drive/Dropbox/etc) so local dev stays free.

