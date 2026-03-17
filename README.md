# Frontier Industry Calculator

Static HTML production planner for EVE Frontier industry chains.

This project is intended to become a standalone GitHub repository.
Its job is to load normalized industry data, let a user pick a craft target, and then work through:

- raw materials to mine
- components to produce
- progress against the current plan
- multi-level dependency chains when needed
- total runtime, mass, and volume

## Product Direction

This project is HTML-first.
The end user should only need the app and data files.

Supported input modes:

1. `calculator_graph.json` as the primary runtime format
2. a stripped folder as a fallback:
   - `types.json`
   - `industry_blueprints.json`
3. optional `item_icons.zip` for local item icons

CSV is useful for Google Sheets, but not as the main runtime format for the calculator itself.

## Data Provenance

The calculator does not read the raw EVE client directly.
The source flow is:

1. use `Phobos` to extract and normalize the client data
2. keep the stripped outputs we actually need:
   - `data/stripped/types.json`
   - `data/stripped/industry_blueprints.json`
3. optionally produce local icons as `item_icons.zip`
4. run `scripts/generate_calculator_graph.py` against the stripped folder to build `calculator_graph.json`
5. load the generated graph in `web/`, or point the app at the stripped folder if you want to use the fallback browser path

The stripped-folder browser path is supported in the app, but treat it as a secondary flow until you verify it in your environment.

## Credits and References

The calculator data flow and presentation are informed by the projects below.
The table is kept here because this repository is specifically about the calculator.

| Project | Role in this calculator | Notes |
| --- | --- | --- |
| [pyfa-org/Phobos](https://github.com/pyfa-org/Phobos) | Source data foundation | Base extraction/data model the calculator builds on. |
| [ProtoDroidBot](https://github.com/ProtoDroidBot) | Data adoption layer | Adapted the Phobos data for downstream use. |
| [Scetrov](https://github.com/Scetrov) | Data upgrade layer | Improved and expanded the data we use now. |
| [Ravencraft-Labs/powerlay-frontier](https://github.com/Ravencraft-Labs/powerlay-frontier) | Product inspiration | A useful reference for the calculator idea, structure, and presentation. |

## Current Status

This folder is now a working v1 workbench:

- repo-ready structure
- product docs
- normalized graph schema draft
- graph generator
- generator tests
- browser-side calculator logic tests
- graph JSON upload in the browser
- stripped folder upload in the browser
- optional icon ZIP upload in the browser
- craftable item search
- search by exact `typeID`
- category/group catalog filtering
- dense workbench layout with left target setup, center plan surface, and right summary rail
- quantity-driven recipe summary
- raw materials to mine table
- components to produce table
- quantitative progress tracking with local persistence
- compact dependency outline
- alternative recipe selection for the selected target
- inline alternate recipe selection from dependency outline rows
- total runtime, mass, and volume summary

Still missing:

- export flows
- multi-target planning
- byproduct reuse across branches
- per-node progress tracking deeper than direct components and raw materials

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

## How to Run

### Recommended runtime bundle

If you already have `calculator_graph.json`, the minimal runtime bundle is:

- `web/`
- `calculator_graph.json`
- optional `item_icons.zip`

Open `web/index.html` and load the files through the browser file pickers.

### From stripped Phobos outputs

If you only have the stripped data, the minimum source bundle is:

- `web/`
- `data/stripped/types.json`
- `data/stripped/industry_blueprints.json`
- optional `item_icons.zip`

In that case, first run the graph generator, then open the browser app with the generated graph.

### Graph generation

The project already includes a first generator:

```bash
python3 scripts/generate_calculator_graph.py \
  --stripped-dir /path/to/phobos-output/data/stripped \
  --output /tmp/calculator_graph.json
```

Current behavior:

- builds `items`
- builds `recipes`
- indexes recipes by produced output type
- marks `baseMaterials` using the current leaf heuristic:
  material is treated as base if it is used as an input and has no recipe that produces it
- only needs the stripped Phobos outputs listed above
- does not require the full source repository if you already have the stripped files and icons

## Near-Term Development Plan

1. Add export or shareable views
2. Add multi-target planning
3. Extend planning beyond direct components/raw materials
4. Improve tree UX and selection flow further
5. Add smarter byproduct handling

## Browser Constraint

The app should prefer file picker and drag-and-drop flows.
Direct filesystem path strings are not reliable in a static browser app because of browser sandbox restrictions.
The stripped-folder browser path exists for convenience, but the graph-file flow is the recommended one.
