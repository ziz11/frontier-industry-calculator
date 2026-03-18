function getRecipeOptionsForType(typeId, recipeOptionsByType = {}) {
  const options = recipeOptionsByType[typeId] ?? recipeOptionsByType[String(typeId)] ?? [];
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .filter((option) => option && Number.isFinite(Number(option.blueprintId)))
    .slice()
    .sort((left, right) => Number(left.blueprintId) - Number(right.blueprintId));
}

function getDefaultRecipeForType(typeId, recipeOptionsByType = {}) {
  const options = getRecipeOptionsForType(typeId, recipeOptionsByType);
  return options[0] ?? null;
}

function resolveRecipeForType(typeId, recipeChoiceByType = {}, recipeOptionsByType = {}) {
  const options = getRecipeOptionsForType(typeId, recipeOptionsByType);
  if (!options.length) {
    return null;
  }

  const chosenBlueprintId = Number(recipeChoiceByType[typeId] ?? recipeChoiceByType[String(typeId)]);
  if (Number.isFinite(chosenBlueprintId)) {
    const matched = options.find((option) => Number(option.blueprintId) === chosenBlueprintId);
    if (matched) {
      return matched;
    }
  }

  return options[0];
}

module.exports = {
  getDefaultRecipeForType,
  resolveRecipeForType,
};
