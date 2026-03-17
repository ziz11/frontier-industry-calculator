# Product Notes

## Goal

Ship a static HTML production planner that feels like a real local tool, not a raw data viewer.

## Data Flow

The app is designed around Phobos-derived inputs:

- Phobos extracts and normalizes the client data outside this repository
- this repo consumes the stripped outputs
- the graph generator turns the stripped inputs into `calculator_graph.json`
- the browser app loads either the generated graph or, secondarily, a stripped folder

The stripped-folder browser path exists, but the graph-file flow should be treated as the primary and safest route.

## Primary User Tasks

- load one data file or a stripped data folder
- optionally load a local icon ZIP
- search for an item by English name
- search by exact `typeID`
- browse craftable items by category/group when useful
- select the target
- choose requested quantity
- switch between alternate recipes when they exist
- review `Raw Materials to Mine`
- review `Components to Produce`
- track mined/produced progress for the current plan
- inspect the dependency outline only when more detail is needed

## MVP Boundaries

MVP should not depend on:

- a backend
- Electron
- a live game client
- game log parsing
- price APIs

MVP should focus on:

- deterministic local calculations
- clean search and target setup
- clear operational outputs
- accurate totals from the loaded data
- local-first persistence of the current plan state

## Required Files

For the recommended runtime flow, the only required files are:

- `web/`
- `calculator_graph.json`

Optional:

- `item_icons.zip`

For the stripped-data flow, the required source files are:

- `types.json`
- `industry_blueprints.json`

Then run the generator to create `calculator_graph.json` before loading the web app.

## Current MVP Slice

The first implemented slice should already cover:

- loading `calculator_graph.json`
- loading a stripped folder in-browser
- searching craftable outputs by English name
- selecting one output target
- filtering the catalog by category/group
- scaling recipes by requested quantity
- showing recursive dependencies
- showing direct components separately from base materials
- showing raw materials as a mining list
- tracking mined/produced progress quantitatively
- saving plan progress in `localStorage`
- showing total runtime, base mass, and base volume
- switching recipe path when `recipesByOutput[typeID]` has alternatives
- switching recipe path from the dependency outline for multi-path nodes
- rendering local item icons from `item_icons.zip` when available

Current defaults:

- single-target planner only
- `calculator_graph.json` via file picker is the recommended flow
- `item_icons.zip` via file picker is optional enrichment
- first recipe is selected by default
- the `Data` section is open only before a graph is loaded, then collapses but remains available
- tree opens the first dependency level by default
- byproducts are displayed but not reused to offset other requirements
- recipe choices are keyed by `typeID` within the current plan
- progress tracking applies only to raw materials and direct components in v1

## UX Direction

The UI should present:

- a compact `Data` disclosure for graph/folder/icon inputs
- a search-first target setup flow with category/group filtering
- a dense workbench layout:
  - left `Target`
  - center `Plan`
  - right `Summary`
- `Raw Materials to Mine` and `Components to Produce` as the main operational surface
- a compact dependency outline instead of stacked tree cards
- inline recipe-path discovery and selection for alternate-blueprint nodes

The visual tone should feel closer to a dense planner/workbench than a dashboard.
