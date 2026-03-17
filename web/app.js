const graphFileInput = document.getElementById("graphFile");
const folderInput = document.getElementById("folderInput");
const statusPill = document.getElementById("statusPill");

function setStatus(text) {
  if (statusPill) {
    statusPill.textContent = text;
  }
}

graphFileInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  setStatus(`Graph selected: ${file.name}`);
});

folderInput?.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const names = new Set(files.map((file) => file.name));
  const hasTypes = names.has("types.json");
  const hasBlueprints = names.has("industry_blueprints.json");

  if (hasTypes && hasBlueprints) {
    setStatus("Stripped folder selected");
  } else {
    setStatus("Folder selected, but required stripped files are missing");
  }
});

