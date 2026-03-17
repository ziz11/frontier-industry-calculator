# Frontier Industry Calculator

Static HTML calculator for EVE Frontier industry chains.

This project is intended to become a standalone GitHub repository.
Its job is to load normalized industry data, let a user pick a craft target, and then explore:

- direct recipe inputs and outputs
- multi-level component chains
- total runtime
- rolled-up material totals
- raw ore or base-material requirements

## Product Direction

This project is HTML-first.
The end user should only need the app and data files.

Supported input modes:

1. `calculator_graph.json` as the primary runtime format
2. a stripped folder as a fallback:
   - `types.json`
   - `industry_blueprints.json`

CSV is useful for Google Sheets, but not as the main runtime format for the calculator itself.

## Current Status

This folder is a clean product scaffold:

- repo-ready structure
- product docs
- normalized graph schema draft
- graph generator
- generator tests
- sample data placeholders
- static web shell for the future calculator UI

No final calculator logic is implemented yet.

## Structure

```text
frontier-industry-calculator/
  README.md
  docs/
  schemas/
  samples/
  scripts/
  tests/
  web/
```

## Related Data Source

The current repository can already produce split data under:

- `evefrontier_datasets_split/<snapshot>/data/stripped/types.json`
- `evefrontier_datasets_split/<snapshot>/data/stripped/industry_blueprints.json`

Those files are the input for the future graph generator.

## Current Generator

The project already includes a first generator:

```bash
python3 frontier-industry-calculator/scripts/generate_calculator_graph.py \
  --stripped-dir evefrontier_datasets_split/16.03.2026.reapers/data/stripped \
  --output /tmp/calculator_graph.json
```

Current behavior:

- builds `items`
- builds `recipes`
- indexes recipes by produced output type
- marks `baseMaterials` using the current leaf heuristic:
  material is treated as base if it is used as an input and has no recipe that produces it

## Near-Term Development Plan

1. Generate `calculator_graph.json` from the stripped split artifacts
2. Load that graph in the browser
3. Add item search and recipe summary
4. Add recursive tree expansion and total rollups
5. Add fallback loading from a stripped folder

## Browser Constraint

The app should prefer file picker and drag-and-drop flows.
Direct filesystem path strings are not reliable in a static browser app because of browser sandbox restrictions.
