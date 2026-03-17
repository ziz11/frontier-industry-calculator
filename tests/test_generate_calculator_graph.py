from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "frontier-industry-calculator" / "scripts" / "generate_calculator_graph.py"


def load_generator_module():
    spec = importlib.util.spec_from_file_location("generate_calculator_graph", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class GenerateCalculatorGraphTests(unittest.TestCase):
    def test_build_graph_creates_items_recipes_and_leaf_base_materials(self) -> None:
        generator = load_generator_module()

        types_data = {
            "100": {
                "typeID": 100,
                "name": "Raw Ore A",
                "groupID": 10,
                "categoryID": 1,
                "mass": 1.0,
                "volume": 1.0,
            },
            "200": {
                "typeID": 200,
                "name": "Component A",
                "groupID": 20,
                "categoryID": 2,
                "mass": 2.0,
                "volume": 0.5,
            },
            "300": {
                "typeID": 300,
                "name": "Final Product",
                "groupID": 30,
                "categoryID": 3,
                "mass": 3.0,
                "volume": 0.25,
            },
        }
        blueprints_data = {
            "1000": {
                "blueprintID": 1000,
                "primaryTypeID": 200,
                "runTime": 5,
                "inputs": [{"typeID": 100, "quantity": 2}],
                "outputs": [{"typeID": 200, "quantity": 1}],
            },
            "1001": {
                "blueprintID": 1001,
                "primaryTypeID": 300,
                "runTime": 10,
                "inputs": [{"typeID": 200, "quantity": 3}],
                "outputs": [{"typeID": 300, "quantity": 1}],
            },
        }

        graph = generator.build_calculator_graph(
            snapshot="demo.snapshot",
            types_data=types_data,
            blueprints_data=blueprints_data,
        )

        self.assertEqual(1, graph["meta"]["schemaVersion"])
        self.assertEqual("demo.snapshot", graph["meta"]["snapshot"])
        self.assertIn("100", graph["items"])
        self.assertIn("1000", graph["recipes"])
        self.assertEqual([1000], graph["recipesByOutput"]["200"])
        self.assertEqual([1001], graph["recipesByOutput"]["300"])
        self.assertEqual([100], graph["baseMaterials"])
        self.assertTrue(graph["items"]["200"]["isCraftable"])
        self.assertFalse(graph["items"]["200"]["isBaseMaterial"])
        self.assertFalse(graph["items"]["300"]["isBaseMaterial"])
        self.assertTrue(graph["items"]["100"]["isBaseMaterial"])

    def test_generate_graph_file_from_stripped_dir_writes_json_output(self) -> None:
        generator = load_generator_module()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            stripped_dir = root / "data" / "stripped"
            stripped_dir.mkdir(parents=True)

            (stripped_dir / "types.json").write_text(
                json.dumps(
                    {
                        "100": {
                            "typeID": 100,
                            "name": "Raw Ore A",
                            "groupID": 10,
                            "categoryID": 1,
                            "mass": 1.0,
                            "volume": 1.0,
                        },
                        "200": {
                            "typeID": 200,
                            "name": "Component A",
                            "groupID": 20,
                            "categoryID": 2,
                            "mass": 2.0,
                            "volume": 0.5,
                        },
                    }
                ),
                encoding="utf-8",
            )
            (stripped_dir / "industry_blueprints.json").write_text(
                json.dumps(
                    {
                        "1000": {
                            "blueprintID": 1000,
                            "primaryTypeID": 200,
                            "runTime": 5,
                            "inputs": [{"typeID": 100, "quantity": 2}],
                            "outputs": [{"typeID": 200, "quantity": 1}],
                        }
                    }
                ),
                encoding="utf-8",
            )

            output_path = root / "calculator_graph.json"
            result = generator.generate_graph_file(
                stripped_dir=stripped_dir,
                output_path=output_path,
                snapshot="demo.snapshot",
            )

            self.assertTrue(output_path.exists())
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual("demo.snapshot", payload["meta"]["snapshot"])
            self.assertEqual([100], payload["baseMaterials"])
            self.assertEqual(output_path, result["output_path"])


if __name__ == "__main__":
    unittest.main()
