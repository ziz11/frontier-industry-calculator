const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createPlannerRuntime } = require("../web/app.js");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "web", "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(__dirname, "..", "web", "styles.css"), "utf8");

test("mode switch exists", () => {
  assert.match(indexHtml, /id="modeCalculator"/);
  assert.match(indexHtml, /id="modePlanner"/);
});

test("default mode is calculator", () => {
  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-default",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      savePlannerState: () => {},
      loadPlannerState: () => null,
      computePlannerPlan: () => ({
        rawMaterials: [],
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  assert.equal(runtime.getRenderModel().mode, "calculator");
});

test("switching to planner has planner regions in markup", () => {
  assert.match(indexHtml, /data-testid="planner-left"/);
  assert.match(indexHtml, /data-testid="planner-center"/);
  assert.match(indexHtml, /data-testid="planner-right"/);
});

test("hidden attribute has an explicit CSS override guard", () => {
  assert.match(stylesCss, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("planner state loads and persists", () => {
  const calls = {
    saved: null,
    loaded: false,
  };

  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-1",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      loadPlannerState: () => {
        calls.loaded = true;
        return {
          planLines: [{ lineId: "l1", outputTypeId: 42, quantity: 2 }],
          recipeChoiceByType: {},
          uiState: {},
          datasetFingerprint: "fp-1",
        };
      },
      savePlannerState: (state) => {
        calls.saved = state;
      },
      computePlannerPlan: ({ planLines }) => ({
        rawMaterials: planLines.map((line) => ({ typeId: line.outputTypeId, quantity: line.quantity })),
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  runtime.load();
  runtime.updateLineQuantity("l1", 3);

  assert.equal(calls.loaded, true);
  assert.equal(calls.saved.planLines[0].quantity, 3);
});

test("adding line updates computed center output", () => {
  const runtime = createPlannerRuntime({
    datasetFingerprint: "fp-2",
    plannerSupport: {
      createEmptyPlannerState: (datasetFingerprint) => ({
        planLines: [],
        recipeChoiceByType: {},
        uiState: {},
        datasetFingerprint,
      }),
      loadPlannerState: () => null,
      savePlannerState: () => {},
      computePlannerPlan: ({ planLines }) => ({
        rawMaterials: planLines.map((line) => ({ typeId: line.outputTypeId, quantity: line.quantity })),
        components: [],
        dependencyOutline: [],
        totals: { totalRuntime: 0, totalMass: 0, totalVolume: 0 },
        decisions: [],
        decisionSummary: { totalMultiPathItems: 0, defaultCount: 0, overriddenCount: 0 },
      }),
    },
  });

  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 88, quantity: 5 });

  assert.deepEqual(runtime.getRenderModel().plannerResult.rawMaterials, [{ typeId: 88, quantity: 5 }]);
});

test("browser runtime without require still computes planner output and persists state", () => {
  const storage = new Map();
  const context = {
    console,
    Date,
    Intl,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appJs, context);

  const runtime = context.FrontierIndustryCalculator.createPlannerRuntime({
    datasetFingerprint: "fp-browser",
    recipeOptionsByType: {
      600: [{ blueprintId: 6001 }, { blueprintId: 6002 }],
    },
    expandDependencies(typeId, quantity, resolveRecipeFn) {
      return {
        typeId,
        quantity,
        runs: quantity,
        isBaseMaterial: false,
        recipe: resolveRecipeFn(typeId),
        runtime: 0,
        mass: 0,
        volume: 0,
        children: [
          {
            typeId: 100,
            quantity: resolveRecipeFn(typeId)?.blueprintId === 6002 ? quantity : quantity * 2,
            runs: 0,
            isBaseMaterial: true,
            recipe: null,
            runtime: 0,
            mass: 0,
            volume: 0,
            children: [],
          },
        ],
      };
    },
  });

  runtime.load();
  runtime.addLine({ lineId: "line-a", outputTypeId: 600, quantity: 3 });
  runtime.selectRecipe(600, 6002);

  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.getRenderModel().plannerResult.rawMaterials)),
    [{ typeId: 100, quantity: 3 }],
  );

  const stored = JSON.parse(storage.get("fic.planner.v1.fp-browser"));
  assert.equal(stored.planLines.length, 1);
  assert.equal(stored.recipeChoiceByType[600], 6002);
});

test("browser mode switch works when click target is nested text content", () => {
  const elements = new Map();

  function createElement(id) {
    const element = {
      id,
      hidden: id === "plannerShell",
      value: "",
      checked: false,
      open: false,
      innerHTML: "",
      textContent: "",
      placeholder: "",
      disabled: false,
      dataset: {},
      listeners: {},
      setAttribute() {},
      addEventListener(type, handler) {
        this.listeners[type] = handler;
      },
      querySelector() {
        return null;
      },
      closest(selector) {
        if (selector === "[data-mode]" && this.dataset.mode) {
          return this;
        }
        return null;
      },
    };
    elements.set(id, element);
    return element;
  }

  const document = {
    getElementById(id) {
      return elements.get(id) || createElement(id);
    },
  };

  const context = {
    console,
    Date,
    Intl,
    document,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(appJs, context);

  const modePlanner = elements.get("modePlanner");
  const plannerShell = elements.get("plannerShell");
  const calculatorShell = elements.get("calculatorShell");
  modePlanner.dataset.mode = "planner";

  const textNodeTarget = {
    parentElement: modePlanner,
  };

  assert.equal(plannerShell.hidden, true);
  assert.equal(calculatorShell.hidden, false);

  assert.doesNotThrow(() => {
    modePlanner.listeners.click({ target: textNodeTarget });
  });

  assert.equal(plannerShell.hidden, false);
  assert.equal(calculatorShell.hidden, true);
});
