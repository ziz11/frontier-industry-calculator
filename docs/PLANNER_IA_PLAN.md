# Planner IA + Implementation Plan (v1)

## Why a Separate Planner IA

The current app is optimized for **single-target inspection** (search one output, inspect dependency chain, switch recipes inline). For multi-target planning, forcing additional controls into the same surface will overload the single-target flow and create state conflicts.

So v1 should introduce a **mode switch** with two distinct products inside one app:

1. **Calculator** (existing): single-target inspection workflow
2. **Planner** (new): multi-target plan assembly and aggregated optimization workflow

---

## Information Architecture

## Global App Frame

- Keep shared top bar + dataset status.
- Add top-level mode tabs:
  - `Calculator`
  - `Planner`
- Tabs are peer routes/views, not toggles inside the current target panel.
- Each mode maintains its own UI state and persisted state.

## Mode 1: Calculator (existing)

- Preserve current interaction model and layout.
- No behavior regressions.
- Existing local persistence keys remain valid.

## Mode 2: Planner (new)

Planner view uses a dedicated 3-column workbench:

### Left: Target Plan Builder

Purpose: add and manage multiple blueprint targets.

Components:
- catalog search + filters (reuse dataset catalog primitives)
- `Add to Plan` action
- plan line table/list:
  - item icon/name/typeID
  - quantity input (integer >= 1)
  - selected recipe variant badge
  - remove line action
- per-line warnings for invalid/obsolete recipe references

Behavior:
- multiple lines may reference same output item (allowed in v1, merged in aggregation)
- quantity edits are debounced and persisted locally

### Center: Aggregated Plan Output

Purpose: show aggregate results across all plan lines.

Sections:
- `Total Raw Materials to Mine`
- `Total Components to Produce`
- `Aggregated Dependency Chain`
- `Totals` strip/cards:
  - total runtime
  - total mass
  - total volume

Rules:
- all totals are computed from merged dependency expansion of all lines
- chain supports expand/collapse, depth controls, and coverage/tracking hooks compatible with existing tree concepts

### Right: Decision Panel (Path Selection)

Purpose: resolve ambiguous production paths where multiple blueprints/recipes exist.

Panel content (required):
- list of decision groups for multi-blueprint items in current aggregate plan
- each option row must show:
  - blueprint id / label
  - output quantity
  - runtime
  - key input hints (top/high-signal inputs)

Interaction:
- selecting an option applies recipe choice by **plan-level by-type scope** in v1
  - i.e., one selected recipe per output type across the whole plan
- panel clearly indicates overridden/default choices
- unresolved items (if any) are highlighted with actionable state

Highlighting requirements:
- every multi-blueprint item in plan builder and aggregated chain is visually marked (badge + accent style)
- clicking a highlighted node can focus the corresponding decision group in the right rail

---

## State Model & Persistence

## Planner state (new)

Persist under a dedicated key namespace (example):
- `fic.planner.v1.*`

Suggested shape:

- `planLines`: array of `{ lineId, outputTypeId, quantity }`
- `recipeChoiceByType`: map `{ [outputTypeId]: blueprintId }` (plan-level scope)
- `ui`:
  - expanded/collapsed nodes
  - panel focus selection
  - filters/sort preferences
- optional snapshot metadata:
  - dataset fingerprint/hash to invalidate stale references

Persistence behavior:
- autosave on every relevant mutation
- on dataset change, attempt migration/rebinding; otherwise mark stale entries and prompt cleanup

Isolation:
- calculator and planner states must be independent to avoid cross-mode side effects

---

## Computation Model (Planner)

1. Normalize plan lines
   - merge duplicate output types by summed quantity for compute stage
2. Resolve recipe path per node
   - if `recipeChoiceByType[typeId]` exists and valid, use it
   - else use deterministic default (current-first strategy)
3. Expand dependencies per line and aggregate into global maps
4. Derive outputs:
   - raw materials rollup
   - direct/derived components rollup
   - full dependency chain (aggregated graph/tree)
   - total runtime/mass/volume
5. Identify decision set
   - collect all output types in aggregate graph with >1 recipe path
   - decorate with option metadata for right-side panel

v1 simplification:
- byproduct reuse remains out-of-scope (consistent with current behavior)

---

## Implementation Plan

## Phase A — Foundation (IA + Routing + State)

- introduce app mode shell (Calculator/Planner tabs)
- refactor current calculator init/render into explicit `calculatorView`
- scaffold `plannerView` with empty-state panels
- add planner-specific store + localStorage adapter
- define shared dataset service used by both views

Deliverable:
- mode switching works without calculator regression

## Phase B — Planner Target Builder

- implement multi-line target list CRUD
- wire catalog search/filter -> add line
- implement quantity editing + validation
- persist/restore planner lines

Deliverable:
- user can build and persist multi-target list

## Phase C — Aggregation Engine

- extract compute engine from single-target flow into reusable planner-capable module
- add aggregate expansion across lines
- compute and render:
  - raw materials
  - components
  - dependency chain
  - runtime/mass/volume totals

Deliverable:
- planner center column returns correct aggregated outputs

## Phase D — Decision Panel + Multi-Path Highlighting

- detect all multi-blueprint types in current aggregate plan
- render right panel decision groups with required metadata fields
- implement by-type plan-level recipe selection and recompute
- add visual highlighting + click-to-focus behavior in left/center surfaces

Deliverable:
- planner recipe decisions are explicit, discoverable, and controllable

## Phase E — Polish + Hardening

- dataset-change stale-state handling
- performance pass (memoization/caching for large plans)
- accessibility pass (keyboard + labels + focus management)
- test coverage (unit + interaction smoke)

Deliverable:
- v1 planner ready for regular use on large dependency sets

---

## Acceptance Criteria for v1 Planner

- user can add multiple blueprint targets and set quantities
- aggregate output includes raw materials, components, full chain, runtime/mass/volume totals
- all multi-blueprint items are clearly highlighted
- decision panel displays blueprint id/label, output quantity, runtime, key input hints
- recipe selection applies at plan-level by-type scope
- planner state persists locally and restores correctly
- calculator workflow remains intact and unchanged in behavior

---

## Out of Scope (v1)

- per-line recipe override scope (line-level)
- byproduct reuse optimization
- cross-plan comparison UI
- collaborative/cloud persistence
