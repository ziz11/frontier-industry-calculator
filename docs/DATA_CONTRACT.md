# Data Contract

## Supported Input Modes

### 1. Normalized Graph JSON

Preferred runtime input:

- `calculator_graph.json`

This is the format the HTML app should optimize for.

### 2. Stripped Folder

Fallback runtime input:

- `types.json`
- `industry_blueprints.json`

This mode exists so the app can still work without a pre-generated graph file.
The stripped folder is expected to contain exactly these two files.

### 3. Local Icon ZIP

Optional enrichment input:

- `item_icons.zip`

The calculator can use this for local item artwork without depending on an external service.

## Source Files From Phobos

The pinned source branch/commit used for the current pipeline is:

- [`Phobos_EVE_Frontier@f2bcf24705d1e924e40729c5abf3055667f06d4e`](https://github.com/ziz11/Phobos_EVE_Frontier/commit/f2bcf24705d1e924e40729c5abf3055667f06d4e)

The raw client data is extracted and normalized outside this repository with `Phobos`.
From that pipeline, this repo only needs the stripped outputs:

- `data/stripped/types.json`
- `data/stripped/industry_blueprints.json`

If icons are available, they can be packaged separately as `item_icons.zip`.

## Why Graph JSON

The calculator needs recursive traversal and rollups.
Those operations are awkward in CSV and simpler in a normalized graph format.

## Proposed Graph Shape

Top-level sections:

- `meta`
- `items`
- `recipes`
- `recipesByOutput`
- `baseMaterials`

### `meta`

```json
{
  "schemaVersion": 1,
  "snapshot": "16.03.2026.reapers",
  "generatedAt": "2026-03-17T00:00:00Z"
}
```

### `items`

Keyed by `typeID`.

```json
{
  "88561": {
    "typeID": 88561,
    "name": "Thermal Composites",
    "groupID": 4780,
    "categoryID": null,
    "mass": null,
    "volume": null,
    "isBaseMaterial": false,
    "isCraftable": true
  }
}
```

### `recipes`

Keyed by `blueprintID`.

```json
{
  "1000": {
    "blueprintID": 1000,
    "primaryTypeID": 88561,
    "runTime": 4,
    "inputs": [
      { "typeID": 88510, "quantity": 140 }
    ],
    "outputs": [
      { "typeID": 88561, "quantity": 14 }
    ]
  }
}
```

### `recipesByOutput`

Keyed by `typeID`.

```json
{
  "88561": [1000]
}
```

### `baseMaterials`

List of type IDs treated as leaf materials for full rollup and raw-material planning.

```json
[88510, 88511, 88512]
```

## Current Heuristic

For the first implementation, `baseMaterials` are derived by a simple rule:

- the item appears in recipe inputs
- the item does not appear as an output of any known recipe

This is enough for the first tree, rollup, and mining-list implementation.
If later we need stricter ore classification or byproduct-aware planning, we can add explicit flags or a separate mapping layer.

## Current Runtime Interpretation

The browser currently interprets the graph with these rules:

- calculations are quantity-driven, not run-driven
- runs needed are `ceil(requestedQuantity / selectedOutputQuantity)`
- if one recipe outputs multiple items, all outputs are shown as byproducts
- byproducts are displayed in the tree and summary but are not reused automatically
- if one output has multiple recipes, the UI defaults to the first recipe and allows switching
- if the recipe graph loops back to an ancestor item, recursion stops and the node is marked as a cycle

## Runtime Bundle Summary

Minimum bundle if the graph already exists:

- `web/`
- `calculator_graph.json`
- optional `item_icons.zip`

Minimum bundle if you only have stripped source data:

- `web/`
- `types.json`
- `industry_blueprints.json`
- optional `item_icons.zip`

In that case, generate `calculator_graph.json` first, then load the browser app with the graph.

## UI-Level Expectations

The loaded data should support:

- alternate recipes for the same output type
- exact `typeID` lookup
- category/group browsing
- raw-material and component rollups
- local progress persistence
- optional icon resolution from a ZIP file
