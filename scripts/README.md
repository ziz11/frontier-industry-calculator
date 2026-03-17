# Scripts

This folder contains helper scripts for:

- generating `calculator_graph.json`
- validating graph files against the schema
- producing demo fixtures for the web app
- building optional local icon ZIPs

The main generator input is the stripped Phobos output folder that contains:

- `data/stripped/types.json`
- `data/stripped/industry_blueprints.json`

If you already have `calculator_graph.json`, the browser app can load that directly and you do not need to run the generator.

Browser-side uploads are also supported for:

- `calculator_graph.json`
- a stripped folder containing the two files above
- optional `item_icons.zip`

## Available Script

### `generate_calculator_graph.py`

Generates a normalized `calculator_graph.json` from stripped Phobos data.

Example:

```bash
python3 scripts/generate_calculator_graph.py \
  --stripped-dir /path/to/phobos-output/data/stripped \
  --output /tmp/calculator_graph.json
```

The script only needs the stripped `types.json` and `industry_blueprints.json` inputs.
