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
