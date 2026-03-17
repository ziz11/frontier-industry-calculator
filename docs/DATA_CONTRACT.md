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

### 3. Local Icon ZIP

Optional enrichment input:

- `item_icons.zip`

The calculator can use this for local item artwork without depending on an external service.

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

## UI-Level Expectations

The loaded data should support:

- alternate recipes for the same output type
- exact `typeID` lookup
- category/group browsing
- raw-material and component rollups
- local progress persistence
- optional icon resolution from a ZIP file
