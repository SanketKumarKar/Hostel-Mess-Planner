# FeastFull Business Brief

A long-form SaaS document for hostel dining operations and RAG ingestion.

## Executive Summary

_What FeastFull is_

FeastFull is a role-based SaaS platform for hostel dining operations.

It unifies menu planning, voting, feedback, announcements, and reporting in one workflow.

The product is built for institutions that need a repeatable and auditable dining process.

## Business Problem

_Why the app exists_

Manual mess coordination usually lives across messages, calls, and spreadsheets.

That creates confusion, weak accountability, and slow reaction times.

FeastFull replaces that with a structured workflow and a shared source of truth.

## Target Market

_Who buys it_

The strongest market is campus dining, especially hostels and student mess systems.

The model also fits private caterers, training campuses, and institutional cafeterias.

Any environment with recurring menus and multiple stakeholders can use the platform.

## Primary Users

_Who uses it every day_

Students vote and submit feedback.

Caterers plan menus, post updates, and review response data.

Admins create sessions, approve items, and finalize the official menu.

## Adoption Drivers

_Why users return_

Students return because they can influence food outcomes.

Caterers return because the planning workflow is simpler and more informed.

Admins return because the system gives them control and visibility.

## Authentication

_How access is established_

Supabase auth supports email/password and Google OAuth.

New users create structured profiles so the app knows their role and assignments.

That onboarding data powers downstream targeting, filtering, and workflow routing.

## Student Experience

_How students interact_

Students see the current session, the menu state, announcements, and finalized PDFs.

When voting is open, they can vote on approved items only.

The experience is lightweight so participation becomes a habit.

## Caterer Experience

_How vendors work_

Caterers create menu items for draft sessions and can use AI dish suggestions.

They also publish announcements and review feedback trends.

The app supports both planning and continuous improvement.

## Admin Experience

_Where governance happens_

Admins manage session creation, approvals, voting status, and finalization.

They can also summarize feedback and generate PDF outputs.

This is the operational control center of the product.

## Voting Model

_How preferences are measured_

The app limits participation to eight votes per day per user.

Votes are tied to approved menu items and a specific session.

That creates a controlled demand signal that admins can trust.

## Feedback Model

_How opinions are captured_

Students can submit daily food feedback and general feedback.

Feedback can include meal context and image evidence.

AI summaries help turn many comments into action-ready insights.

## Announcements

_How communication works_

Announcements are targeted by caterer and mess type.

Students only see updates that apply to their profile context.

This reduces noise and makes operational updates more effective.

## AI Dish Suggestions

_Planning support for caterers_

Caterers can enter ingredients and meal type to get bulk dish ideas.

The model is optimized for hostel-scale cooking, not consumer recipes.

This saves ideation time and improves menu diversity.

## AI Feedback Summaries

_Turning comments into reports_

Admins can request an AI-generated summary of recent feedback.

The summary compresses unstructured comments into an executive view.

That lowers the time cost of understanding recurring issues.

## Session Lifecycle

_How menu cycles are governed_

A session moves through draft, open, closed, and finalized states.

One-week and two-week cycles support different institutional timetables.

The state machine keeps everyone aligned on what actions are possible.

## Menu Scheduling

_How dates are handled_

Slot-based date labeling keeps week and day labels stable.

This matters for long menu cycles and print reporting.

The schedule is predictable, readable, and easy to audit.

## CSV Bulk Upload

_Scaling menu entry_

Bulk scheduling allows many menu items to be distributed across a cycle.

Equal and minimum-per-day strategies support different planning styles.

This reduces manual effort when the menu is large.

## PDF Reporting

_Why exports matter_

FeastFull generates branded menu PDFs for finalized sessions.

Printable output still matters in institutional settings.

The PDF artifact is also useful for downstream chatbot ingestion.

## Data Model

_What the backend stores_

The schema centers on profiles, sessions, menu items, votes, feedback, announcements, events, and settings.

Each entity maps to a real business object in the workflow.

That makes the system easy to explain and to index.

## Security

_Why trust matters_

Role-based routing keeps users in the correct workflow.

Validation protects date, text, and enum inputs.

Trust is a product feature because it drives adoption and data quality.

## Scalability

_Why the architecture is production-minded_

The client uses lazy loading for routes.

The server applies rate limits to reads, writes, AI, and PDF endpoints.

Those choices help the app behave like a real SaaS product.

## Retention

_Why users come back_

Voting, feedback, and announcements create recurring reasons to return.

Admins and caterers operate on the same session rhythm.

The app is attached to a daily business process, which supports retention.

## Competitive Advantage

_What makes it different_

FeastFull is more specific than a generic survey tool or a generic food app.

Its role-based workflow reflects the real structure of hostel dining.

That specificity creates practical switching costs.

## Business Model

_How it could be sold_

The product fits subscription SaaS pricing per campus or per hostel network.

AI and reporting features can be positioned as premium tiers.

White-label deployment is also a natural extension.

## Risks

_What could weaken adoption_

The biggest risk is process discipline, not software mechanics.

If profiles, sessions, or approvals are not maintained, the workflow degrades.

AI should assist the process, not become a single point of failure.

## Go-To-Market

_How to position the product_

The best entry point is campus dining and hostel operations.

The pitch should emphasize satisfaction, transparency, and lower coordination cost.

After the first deployment, the same pattern can expand to other institutions.

## RAG Ingestion Notes

_What to index_

Index FeastFull, hostel mess planner, menu voting, caterer dashboard, admin approvals, feedback, announcements, AI summaries, and PDF export.

These keywords provide strong retrieval anchors for a chatbot.

The product story should be indexed alongside the code-level artifacts.

## User Adoption Story

_How the app feels to users_

Students experience visible influence over the menu.

Caterers experience less guesswork and faster planning.

Admins experience a cleaner operating rhythm.

## Operational Value

_Why institutions care_

The platform reduces manual coordination and makes decisions traceable.

It creates a more reliable feedback loop between service and demand.

That improves perceived service quality over time.

## Technical Architecture

FeastFull is organized as a thin React frontend (Vite) and a Node.js API server backed by Supabase (Postgres + Auth). Key runtime responsibilities are separated:

- **Client**: role-aware UI, lazy-loaded routes, and lightweight state for voting and feedback workflows.
- **Server API**: REST endpoints for sessions, menu items, votes, feedback, announcements, and AI helpers. The server enforces business rules (vote limits, approval gates) and provides PDF exports.
- **Data**: Postgres schema in Supabase holds normalized entities (profiles, sessions, menu_items, votes, feedback, announcements, events, settings).
- **AI**: Generative models (Gemini or equivalent) are used for dish suggestion, feedback summarization, and other assistant workflows via dedicated endpoints that accept text and optional images.

This separation enables independent scaling of the frontend, API, and database layers and simplifies horizontal scaling of the AI and PDF workers.


## Data Schema (high level)

- `profiles` — id, name, email, role (student/caterer/admin), mess_assignment, preferences
- `sessions` — id, title, start_date, end_date, cycle_length, status
- `menu_items` — id, session_id, title, ingredients, slot_label, caterer_id, approved(boolean)
- `votes` — id, profile_id, menu_item_id, created_at
- `feedbacks` — id, profile_id, session_id, meal_type, rating, text, image_url
- `announcements` — id, author_id, text, target_mask

This normalized layout supports efficient queries for aggregates (vote counts, item popularity, daily feedback volumes).

## Session Lifecycle & Sequence

Typical sequence for a weekly session:

1. Admin creates `session` in `draft` state and invites caterer entries.
2. Caterers submit `menu_items` into the draft session.
3. Admin reviews and marks items `approved` → session moves to `open_for_voting`.
4. Students cast up to the daily vote cap; votes are tallied in near real time.
5. During `open_for_voting`, admins may request AI summaries of feedback to refine selections.
6. When voting ends, admin finalizes the session; `generate-pdf` produces the branded menu artifact.

This deterministic state machine is enforced server-side to keep UX consistent and auditable.

## Security & Privacy

- **Authentication**: Supabase Auth (email/password + OAuth) with role claims embedded in the session.
- **Authorization**: Role-based checks on every write operation; admin-only endpoints are protected both in the UI and server.
- **Input Validation**: Strict typed validation for dates, enums (meal types, status), and file uploads.
- **Data Retention**: Feedback and images should be retained according to institutional policy; consider retention windows and archival workflows for large image volumes.
- **Privacy**: Images and free text can contain PII; store minimal metadata and offer redaction or opt-out on student-provided images.

## Deployment & Infrastructure

- **Runtime**: Host the Node API and frontend on a cloud provider (Vercel, Render, or any container host). Supabase handles DB and Auth.
- **PDF & AI Workers**: Run PDF generation and AI integration as separate horizontally-scalable workers or as serverless functions to isolate CPU and network spikes.
- **Env & Secrets**: Keep API keys (Gemini, imgbb, Supabase) in a secure store and do not commit them.
- **CI/CD**: Use a pipeline to run linting, tests, and preview deployments; gate production merges with a smoke test that verifies session creation and PDF generation.

## Monitoring, Observability & KPIs

- **Health checks**: uptime checks for API, DB connectivity, and AI worker latencies.
- **Key metrics**: daily active students, votes/day, menu item approval rate, average feedback rating, PDF generation frequency, AI request success rate, mean time to resolution for reported issues.
- **Alerts**: set alerts for rate-limit saturation, queue growth (PDF/AI job backlog), and error-rate spikes.

## Pricing & Go-to-Market Options

- **Core SaaS**: per campus or per hostel network subscription with usage bands (small/medium/large).
- **Add-ons**: premium AI summaries, priority support, white-label branding, and historical analytics exports.
- **Pilot model**: start with a 6–8 week pilot for one or two hostels, measure adoption (votes/DAU) and satisfaction, then expand campus-wide.

## Implementation Roadmap (90 / 180 / 365 days)

- **0–90 days**: pilot deployment, onboarding documentation, feedback collection loop activated, implement basic analytics and error monitoring.
- **90–180 days**: automate CSV import workflows, improve AI prompts for locality-specific menus, add configurable retention and compliance settings.
- **180–365 days**: multi-campus management, SSO integrations, SLA offerings, and richer analytics dashboards for caterer performance.

## SLA & Support

- **SLA tiers**: basic (business hours email), standard (24/7 basic monitoring, 99.9% uptime), enterprise (SLA-backed uptime, dedicated support contact).
- **Support playbook**: incident intake → triage → mitigation → root cause analysis → communication.

## Appendix: Developer References

- **Key files**: [server/index.js](server/index.js#L1) (API wiring), [server/pdfGenerator.js](server/pdfGenerator.js#L1) (PDF routines), [client/src/context/AuthContext.jsx](client/src/context/AuthContext.jsx#L1) (auth flow), [client/src/utils/menuSlots.js](client/src/utils/menuSlots.js#L1) (slot formatting).
- **AI endpoints**: [server/routes/ai.js](server/routes/ai.js#L1) — dish suggestions, feedback summaries, and image upload proxy.

## Conclusion

_Final positioning_

FeastFull is a focused campus dining operating layer with clear SaaS potential. The product combines role-based workflows, auditability, AI-assisted planning, and printable artifacts to serve institutional needs reliably.

Next steps: regenerate the PDF from this expanded Markdown and optionally produce RAG-ready JSONL chunks and embeddings. Tell me whether to regenerate the PDF now, or to first create JSONL chunks for ingestion.
