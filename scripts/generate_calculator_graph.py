#!/usr/bin/env python3
"""Generate calculator_graph.json from stripped Frontier split artifacts."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


SCHEMA_VERSION = 1
FACILITY_PREFIX_ORDER = ["L", "M", "S", "P"]
KNOWN_FACILITY_PREFIX_BY_TYPE_ID = {
    87119: "S",  # Mini Printer
    87120: "L",  # Heavy Printer
    87161: "P",  # Field Refinery
    87162: "P",  # Field Printer
    88063: "M",  # Refinery
    88064: "L",  # Heavy Refinery
    88067: "M",  # Printer
    88068: "M",  # Assembler
    88069: "S",  # Mini Berth
    88070: "M",  # Berth
    88071: "L",  # Heavy Berth
    91978: "P",  # Nursery
}


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


def _resolve_item_name(record: Mapping[str, Any], type_id: int) -> str:
    for key in ("name", "typeName_en-us", "typeName_en", "typeName"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return f"Type {type_id}"


def _ordered_facility_prefixes(prefixes: list[str]) -> list[str]:
    unique_prefixes = list(dict.fromkeys(prefix.strip() for prefix in prefixes if isinstance(prefix, str)))
    return sorted(
        [prefix for prefix in unique_prefixes if prefix in FACILITY_PREFIX_ORDER],
        key=lambda prefix: FACILITY_PREFIX_ORDER.index(prefix),
    )


def _infer_facility_prefix_from_name(name: str | None) -> str | None:
    normalized = (name or "").strip().lower()
    if not normalized:
        return None
    if "portable" in normalized or "field" in normalized:
        return "P"
    if "mini" in normalized:
        return "S"
    if "heavy" in normalized:
        return "L"
    if any(token in normalized for token in ("refinery", "printer", "assembler", "berth", "shipyard")):
        return "M"
    return None


def _resolve_facility_prefix(types_data: Mapping[str, Mapping[str, Any]], facility_type_id: int) -> str | None:
    if facility_type_id in KNOWN_FACILITY_PREFIX_BY_TYPE_ID:
        return KNOWN_FACILITY_PREFIX_BY_TYPE_ID[facility_type_id]

    record = types_data.get(str(facility_type_id), {})
    if not isinstance(record, Mapping):
        return None

    facility_name = record.get("typeName_en-us") or record.get("name")
    if not isinstance(facility_name, str):
        return None

    return _infer_facility_prefix_from_name(facility_name)


def build_recipe_facility_prefixes_by_blueprint(
    types_data: Mapping[str, Mapping[str, Any]],
    facilities_data: Mapping[str, Mapping[str, Any]],
) -> dict[str, list[str]]:
    prefixes_by_blueprint: dict[str, list[str]] = {}

    for facility_type_id, facility_record in _sorted_mapping_items(facilities_data):
        prefix = _resolve_facility_prefix(types_data, facility_type_id)
        if not prefix:
            continue

        for blueprint_ref in facility_record.get("blueprints", []):
            if not isinstance(blueprint_ref, Mapping):
                continue

            blueprint_id = blueprint_ref.get("blueprintID")
            if blueprint_id is None:
                continue

            try:
                blueprint_id_int = int(blueprint_id)
            except (TypeError, ValueError):
                continue

            key = str(blueprint_id_int)
            prefixes_by_blueprint.setdefault(key, []).append(prefix)

    for key, prefixes in list(prefixes_by_blueprint.items()):
        prefixes_by_blueprint[key] = _ordered_facility_prefixes(prefixes)

    return prefixes_by_blueprint


def build_calculator_graph(
    snapshot: str,
    types_data: Mapping[str, Mapping[str, Any]],
    blueprints_data: Mapping[str, Mapping[str, Any]],
    facilities_data: Mapping[str, Mapping[str, Any]] | None = None,
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
            "name": _resolve_item_name(record, type_id),
            "groupID": record.get("groupID"),
            "categoryID": record.get("categoryID"),
            "mass": record.get("mass"),
            "volume": record.get("volume"),
            "isBaseMaterial": is_base_material,
            "isCraftable": is_craftable,
        }

    base_materials = sorted(type_id for type_id in referenced_input_type_ids if type_id not in craftable_type_ids)
    recipe_facility_prefixes_by_blueprint = (
        build_recipe_facility_prefixes_by_blueprint(types_data, facilities_data)
        if isinstance(facilities_data, Mapping)
        else {}
    )

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
        "recipeFacilityPrefixesByBlueprint": recipe_facility_prefixes_by_blueprint,
    }


def generate_graph_file(
    stripped_dir: Path,
    output_path: Path,
    snapshot: str | None = None,
) -> dict[str, Any]:
    types_path = stripped_dir / "types.json"
    blueprints_path = stripped_dir / "industry_blueprints.json"
    facilities_path = stripped_dir / "industry_facilities.json"

    if not types_path.exists():
        raise FileNotFoundError(f"Missing stripped types file: {types_path}")
    if not blueprints_path.exists():
        raise FileNotFoundError(f"Missing stripped blueprints file: {blueprints_path}")

    snapshot_name = snapshot or infer_snapshot_name(stripped_dir)
    types_data = load_json(types_path)
    blueprints_data = load_json(blueprints_path)
    facilities_data = load_json(facilities_path) if facilities_path.exists() else None

    if not isinstance(types_data, Mapping):
        raise TypeError("types.json must be a mapping keyed by typeID")
    if not isinstance(blueprints_data, Mapping):
        raise TypeError("industry_blueprints.json must be a mapping keyed by blueprintID")
    if facilities_data is not None and not isinstance(facilities_data, Mapping):
        raise TypeError("industry_facilities.json must be a mapping keyed by facility typeID")

    graph = build_calculator_graph(
        snapshot=snapshot_name,
        types_data=types_data,
        blueprints_data=blueprints_data,
        facilities_data=facilities_data,
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
