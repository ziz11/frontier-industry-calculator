#!/usr/bin/env python3
"""Generate calculator_graph.json from stripped Frontier split artifacts."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


SCHEMA_VERSION = 1


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def infer_snapshot_name(stripped_dir: Path) -> str:
    if stripped_dir.name == "stripped" and stripped_dir.parent.name == "data":
        return stripped_dir.parent.parent.name
    return stripped_dir.parent.name or stripped_dir.name


def normalize_material_node(node: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "typeID": int(node["typeID"]),
        "quantity": node["quantity"],
    }


def _sorted_mapping_items(data: Mapping[str, Any]) -> list[tuple[int, Mapping[str, Any]]]:
    items: list[tuple[int, Mapping[str, Any]]] = []
    for key, value in data.items():
        if not isinstance(value, Mapping):
            continue
        try:
            items.append((int(key), value))
        except (TypeError, ValueError):
            continue
    items.sort(key=lambda item: item[0])
    return items


def build_calculator_graph(
    snapshot: str,
    types_data: Mapping[str, Mapping[str, Any]],
    blueprints_data: Mapping[str, Mapping[str, Any]],
) -> dict[str, Any]:
    recipes: dict[str, dict[str, Any]] = {}
    recipes_by_output: dict[str, list[int]] = {}
    craftable_type_ids: set[int] = set()

    for blueprint_id, record in _sorted_mapping_items(blueprints_data):
        inputs = [
            normalize_material_node(node)
            for node in record.get("inputs", [])
            if isinstance(node, Mapping) and node.get("typeID") is not None and node.get("quantity") is not None
        ]
        outputs = [
            normalize_material_node(node)
            for node in record.get("outputs", [])
            if isinstance(node, Mapping) and node.get("typeID") is not None and node.get("quantity") is not None
        ]
        primary_type_id = record.get("primaryTypeID")
        if primary_type_id is not None:
            primary_type_id = int(primary_type_id)
        elif outputs:
            primary_type_id = int(outputs[0]["typeID"])

        recipes[str(blueprint_id)] = {
            "blueprintID": int(record.get("blueprintID", blueprint_id)),
            "primaryTypeID": primary_type_id,
            "runTime": record.get("runTime"),
            "inputs": inputs,
            "outputs": outputs,
        }

        for output in outputs:
            output_type_id = int(output["typeID"])
            craftable_type_ids.add(output_type_id)
            recipes_by_output.setdefault(str(output_type_id), []).append(int(blueprint_id))

    referenced_input_type_ids: set[int] = set()
    for recipe in recipes.values():
        for input_node in recipe["inputs"]:
            referenced_input_type_ids.add(int(input_node["typeID"]))

    items: dict[str, dict[str, Any]] = {}
    for type_id, record in _sorted_mapping_items(types_data):
        is_craftable = type_id in craftable_type_ids
        is_base_material = (type_id in referenced_input_type_ids) and not is_craftable
        items[str(type_id)] = {
            "typeID": int(record.get("typeID", type_id)),
            "name": record.get("name"),
            "groupID": record.get("groupID"),
            "categoryID": record.get("categoryID"),
            "mass": record.get("mass"),
            "volume": record.get("volume"),
            "isBaseMaterial": is_base_material,
            "isCraftable": is_craftable,
        }

    base_materials = sorted(type_id for type_id in referenced_input_type_ids if type_id not in craftable_type_ids)

    return {
        "meta": {
            "schemaVersion": SCHEMA_VERSION,
            "snapshot": snapshot,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        "items": items,
        "recipes": recipes,
        "recipesByOutput": recipes_by_output,
        "baseMaterials": base_materials,
    }


def generate_graph_file(
    stripped_dir: Path,
    output_path: Path,
    snapshot: str | None = None,
) -> dict[str, Any]:
    types_path = stripped_dir / "types.json"
    blueprints_path = stripped_dir / "industry_blueprints.json"

    if not types_path.exists():
        raise FileNotFoundError(f"Missing stripped types file: {types_path}")
    if not blueprints_path.exists():
        raise FileNotFoundError(f"Missing stripped blueprints file: {blueprints_path}")

    snapshot_name = snapshot or infer_snapshot_name(stripped_dir)
    types_data = load_json(types_path)
    blueprints_data = load_json(blueprints_path)

    if not isinstance(types_data, Mapping):
        raise TypeError("types.json must be a mapping keyed by typeID")
    if not isinstance(blueprints_data, Mapping):
        raise TypeError("industry_blueprints.json must be a mapping keyed by blueprintID")

    graph = build_calculator_graph(
        snapshot=snapshot_name,
        types_data=types_data,
        blueprints_data=blueprints_data,
    )
    write_json(output_path, graph)
    return {
        "snapshot": snapshot_name,
        "stripped_dir": stripped_dir,
        "output_path": output_path,
        "items_count": len(graph["items"]),
        "recipes_count": len(graph["recipes"]),
        "base_materials_count": len(graph["baseMaterials"]),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate calculator_graph.json from stripped Frontier data")
    parser.add_argument(
        "--stripped-dir",
        required=True,
        help="Path to a stripped data directory containing types.json and industry_blueprints.json",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output path for calculator_graph.json",
    )
    parser.add_argument(
        "--snapshot",
        help="Optional snapshot name override",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    result = generate_graph_file(
        stripped_dir=Path(args.stripped_dir),
        output_path=Path(args.output),
        snapshot=args.snapshot,
    )

    print(f"Snapshot: {result['snapshot']}")
    print(f"Items: {result['items_count']}")
    print(f"Recipes: {result['recipes_count']}")
    print(f"Base materials: {result['base_materials_count']}")
    print(f"Output: {result['output_path']}")


if __name__ == "__main__":
    main()
