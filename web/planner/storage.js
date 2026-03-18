function buildPlannerStorageKey(datasetFingerprint) {
  return `fic.planner.v1.${datasetFingerprint}`;
}

function savePlannerState(state) {
  if (!state || !state.datasetFingerprint) {
    return;
  }

  if (typeof localStorage === "undefined" || !localStorage || typeof localStorage.setItem !== "function") {
    return;
  }

  const key = buildPlannerStorageKey(state.datasetFingerprint);
  const payload = {
    planLines: Array.isArray(state.planLines) ? state.planLines : [],
    recipeChoiceByType: state.recipeChoiceByType && typeof state.recipeChoiceByType === "object" ? state.recipeChoiceByType : {},
    uiState: state.uiState && typeof state.uiState === "object" ? state.uiState : {},
    datasetFingerprint: state.datasetFingerprint,
  };

  localStorage.setItem(key, JSON.stringify(payload));
}

function loadPlannerState(currentDatasetFingerprint) {
  if (!currentDatasetFingerprint) {
    return null;
  }

  if (typeof localStorage === "undefined" || !localStorage || typeof localStorage.getItem !== "function") {
    return null;
  }

  const key = buildPlannerStorageKey(currentDatasetFingerprint);
  const stored = localStorage.getItem(key);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!parsed || parsed.datasetFingerprint !== currentDatasetFingerprint) {
      return null;
    }

    return {
      planLines: Array.isArray(parsed.planLines) ? parsed.planLines : [],
      recipeChoiceByType:
        parsed.recipeChoiceByType && typeof parsed.recipeChoiceByType === "object" ? parsed.recipeChoiceByType : {},
      uiState: parsed.uiState && typeof parsed.uiState === "object" ? parsed.uiState : {},
      datasetFingerprint: parsed.datasetFingerprint,
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  savePlannerState,
  loadPlannerState,
};
