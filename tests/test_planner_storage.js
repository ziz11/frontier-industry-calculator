const test = require("node:test");
const assert = require("node:assert/strict");

const { savePlannerState, loadPlannerState } = require("../web/planner/storage.js");

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  keys() {
    return Array.from(this.store.keys()).sort();
  }
}

function withStorage(run) {
  const previous = global.localStorage;
  const storage = new MemoryStorage();
  global.localStorage = storage;
  try {
    run(storage);
  } finally {
    global.localStorage = previous;
  }
}

test("save then load returns same state", () => {
  withStorage(() => {
    const state = {
      planLines: [{ lineId: "a", outputTypeId: 100, quantity: 2 }],
      recipeChoiceByType: { 100: 2000 },
      uiState: { selectedLineId: "a" },
      datasetFingerprint: "fp-1",
    };

    savePlannerState(state);

    assert.deepEqual(loadPlannerState("fp-1"), state);
  });
});

test("different fingerprint returns null", () => {
  withStorage(() => {
    savePlannerState({
      planLines: [],
      recipeChoiceByType: {},
      uiState: {},
      datasetFingerprint: "fp-a",
    });

    assert.equal(loadPlannerState("fp-b"), null);
  });
});

test("missing key returns null", () => {
  withStorage(() => {
    assert.equal(loadPlannerState("missing-fp"), null);
  });
});

test("corrupted JSON returns null safely", () => {
  withStorage((storage) => {
    storage.setItem("fic.planner.v1.fp-1", "{not valid json");
    assert.equal(loadPlannerState("fp-1"), null);
  });
});

test("planner storage does not interfere with other keys", () => {
  withStorage((storage) => {
    storage.setItem("frontier-industry-calculator:plan:sample", "calculator-data");

    savePlannerState({
      planLines: [{ lineId: "x", outputTypeId: 42, quantity: 1 }],
      recipeChoiceByType: {},
      uiState: {},
      datasetFingerprint: "fp-z",
    });

    assert.equal(storage.getItem("frontier-industry-calculator:plan:sample"), "calculator-data");
    assert.deepEqual(storage.keys(), [
      "fic.planner.v1.fp-z",
      "frontier-industry-calculator:plan:sample",
    ]);
  });
});
