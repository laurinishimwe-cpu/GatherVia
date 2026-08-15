# Architecture Decisions

This directory records decisions that affect more than one client, persistence model, integration, or operational boundary.

An ADR is deliberately short: it states the context, the decision, why it was selected, and the consequences. It is not a task list or a product specification.

## Decision index

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-001](decisions.md#adr-001-fastapi-is-the-authoritative-application-api) | FastAPI is the authoritative application API | Accepted |
| [ADR-002](decisions.md#adr-002-a-persisted-canonical-flyer-payload-drives-every-renderer) | One canonical flyer payload drives every renderer | Accepted |
| [ADR-003](decisions.md#adr-003-bundle-a-small-shared-font-registry) | Bundle a small, shared font registry | Accepted |
| [ADR-004](decisions.md#adr-004-use-rotating-persistent-refresh-sessions) | Use rotating persistent refresh sessions | Accepted |
| [ADR-005](decisions.md#adr-005-make-revenuecat-the-subscription-authority) | RevenueCat is the subscription authority | Accepted |
| [ADR-006](decisions.md#adr-006-enforce-guest-capacity-in-the-api) | Enforce guest capacity in the API | Accepted |
| [ADR-007](decisions.md#adr-007-treat-published-events-as-an-operational-boundary) | Published events form an operational boundary | Accepted |
| [ADR-008](decisions.md#adr-008-use-short-lived-in-memory-query-caches) | Use short-lived, invalidatable query caches | Accepted |
| [ADR-009](decisions.md#adr-009-keep-durable-assets-separate-from-generated-passes) | Separate durable assets from generated passes | Accepted |

## When to add an ADR

Add a record when a change answers a question such as:

- Which system owns a piece of data or a security decision?
- How do web, mobile, and backend stay compatible?
- Does a change affect deployment, costs, security, or the data model?
- Is it difficult or expensive to reverse later?

Do not add an ADR for a local styling change or a straightforward bug fix.

## Status vocabulary

- **Proposed** — being evaluated; not yet relied on.
- **Accepted** — the active direction.
- **Superseded** — retained for history, replaced by a newer decision.
- **Deprecated** — still present temporarily but should not be extended.
