function createEmptyPlannerState(datasetFingerprint) {
  return {
    planLines: [],
    recipeChoiceByType: {},
    uiState: {},
    datasetFingerprint,
  };
}

module.exports = {
  createEmptyPlannerState,
};
