# Product Notes

## Goal

Ship a static HTML calculator that feels like a real tool, not a raw data viewer.

## Primary User Tasks

- load one data file or a stripped data folder
- search for an item by English name
- select the recipe target
- choose quantity or run count
- inspect direct recipe inputs
- inspect component chain one level down or all the way to base materials
- see rolled-up totals
- see total runtime

## MVP Boundaries

MVP should not depend on:

- a backend
- Electron
- a live game client
- game log parsing
- price APIs

MVP should focus on:

- deterministic local calculations
- clean search and navigation
- tree visibility
- accurate totals from the loaded data

## UX Direction

The UI should present:

- a clear load state
- a strong searchable item selection flow
- a top summary panel
- a dependency tree view
- a totals panel
- a base ore or base materials panel

The visual tone should feel closer to a polished companion tool than a spreadsheet.

