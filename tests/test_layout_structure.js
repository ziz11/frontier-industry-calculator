const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(
  path.join(__dirname, "..", "web", "index.html"),
  "utf8",
);

test("calculator page uses tabbed workspace layout with drawers and upload modal", () => {
  assert.match(indexHtml, /class="top-bar"/);
  assert.match(indexHtml, /id="workspaceHeaderTarget"/);
  assert.match(indexHtml, /id="workspaceHeaderProgress"/);
  assert.match(indexHtml, /id="workspaceHeaderEta"/);
  assert.match(indexHtml, /class="workspace-shell"/);
  assert.match(indexHtml, /class="target-dock"/);
  assert.match(indexHtml, /class="workspace-main"/);
  assert.match(indexHtml, /id="searchSection"/);
  assert.match(indexHtml, /id="resultsSection"/);
  assert.match(indexHtml, /id="selectedTargetSection"/);
  assert.match(indexHtml, /id="workspaceTabPlan"/);
  assert.match(indexHtml, /id="workspaceTabPipeline"/);
  assert.match(indexHtml, /id="workspaceTabTree"/);
  assert.match(indexHtml, /id="planWorkspacePanel"/);
  assert.match(indexHtml, /id="pipelineWorkspacePanel"/);
  assert.match(indexHtml, /id="treeWorkspacePanel"/);
  assert.match(indexHtml, /id="nextActionsSection"/);
  assert.match(indexHtml, /id="bottleneckSection"/);
  assert.match(indexHtml, /id="materialsSection"/);
  assert.match(indexHtml, /id="componentsSection"/);
  assert.match(indexHtml, /id="dependencyPipeline"/);
  assert.match(indexHtml, /id="treePreview"/);
  assert.match(indexHtml, /id="datasetDrawer"/);
  assert.match(indexHtml, /id="filtersDrawer"/);
  assert.match(indexHtml, /id="viewDrawer"/);
  assert.match(indexHtml, /id="dataUploadModal"/);
  assert.match(indexHtml, /id="openUploadModal"/);
  assert.match(indexHtml, /id="showRecipeDetailsToggle"/);
  assert.match(indexHtml, /id="showTrackedStatusToggle"/);
  assert.doesNotMatch(indexHtml, /class="workbench-layout"/);
  assert.doesNotMatch(indexHtml, /class="workbench-sidebar"/);
  assert.doesNotMatch(indexHtml, /class="workbench-rail"/);
  assert.doesNotMatch(indexHtml, /id="summaryRail"/);
  assert.doesNotMatch(indexHtml, /id="rawMaterialsPreview"/);
  assert.doesNotMatch(indexHtml, /id="datasetSection"/);
  assert.doesNotMatch(indexHtml, /id="currentPlanSection"/);
});
