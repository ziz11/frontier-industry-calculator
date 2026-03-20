const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(
  path.join(__dirname, "..", "web", "index.html"),
  "utf8",
);

test("calculator page uses dense workbench split layout", () => {
  assert.match(indexHtml, /class="top-bar"/);
  assert.match(indexHtml, /class="workbench-layout"/);
  assert.match(indexHtml, /class="workbench-sidebar"/);
  assert.match(indexHtml, /class="workbench-main"/);
  assert.match(indexHtml, /class="workbench-rail"/);
  assert.match(indexHtml, /<details[^>]+id="dataSection"[^>]+open/);
  assert.match(indexHtml, /id="searchSection"/);
  assert.match(indexHtml, /id="filterSection"/);
  assert.match(indexHtml, /id="resultsSection"/);
  assert.match(indexHtml, /id="selectedTargetSection"/);
  assert.match(indexHtml, /id="rawMaterialsSection"/);
  assert.match(indexHtml, /id="componentsSection"/);
  assert.match(indexHtml, /<details[^>]+id="dependencyOutlineSection"/);
  assert.match(indexHtml, /id="summaryRail"/);
  assert.match(indexHtml, /id="datasetSection"/);
  assert.match(indexHtml, /id="currentPlanSection"/);
  assert.match(indexHtml, /id="showRecipeDetailsToggle"/);
  assert.doesNotMatch(indexHtml, /id="showBlueprintIdsToggle"/);
  assert.match(indexHtml, /id="showTrackedStatusToggle"/);
  assert.doesNotMatch(indexHtml, /class="planner-grid"/);
  assert.doesNotMatch(indexHtml, /class="panel panel-progress"/);
  assert.doesNotMatch(indexHtml, /class="panel panel-summary"/);
  assert.doesNotMatch(indexHtml, /id="treeDensitySelect"/);
});
