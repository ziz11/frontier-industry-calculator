# Scripts

This folder will contain helper scripts for:

- generating `calculator_graph.json`
- validating graph files against the schema
- producing demo fixtures for the web app
- building optional local icon ZIPs

For now the data still comes from the parent repository split pipeline in `data_toolset/`, plus browser-side uploads for graph, stripped folder, and icon ZIP inputs.

## Available Script

### `generate_calculator_graph.py`

Generates a normalized `calculator_graph.json` from stripped split artifacts.

Example:

```bash
python3 frontier-industry-calculator/scripts/generate_calculator_graph.py \
  --stripped-dir evefrontier_datasets_split/16.03.2026.reapers/data/stripped \
  --output /tmp/calculator_graph.json
```
