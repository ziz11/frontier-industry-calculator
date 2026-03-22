const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const stylesCss = fs.readFileSync(
  path.join(__dirname, "..", "web", "styles.css"),
  "utf8",
);

test("view toggle rows keep labels from pushing controls out of layout", () => {
  assert.match(stylesCss, /\.toggle-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/);
  assert.match(stylesCss, /\.toggle-row\s+\.summary-key\s*\{[\s\S]*min-width:\s*0;/);
  assert.match(stylesCss, /\.toggle-row\s+\.summary-key\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(stylesCss, /\.toggle-row\s+\.summary-key\s*\{[\s\S]*text-overflow:\s*ellipsis;/);
  assert.match(stylesCss, /\.toggle-row\s+\.summary-key\s*\{[\s\S]*white-space:\s*nowrap;/);
});

test("drawer backdrops stay unblurred while modal backdrops keep frosted blur", () => {
  assert.match(stylesCss, /\.overlay-backdrop\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.56\);/);
  assert.match(stylesCss, /\.drawer-shell\s+\.overlay-backdrop\s*\{[\s\S]*backdrop-filter:\s*none;/);
  assert.match(stylesCss, /\.modal-shell\s+\.overlay-backdrop\s*\{[\s\S]*backdrop-filter:\s*blur\(6px\);/);
});
