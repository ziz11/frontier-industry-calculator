function isValidQuantity(quantity) {
  return Number.isInteger(quantity) && quantity >= 1;
}

function normalizePlanLines(planLines) {
  const aggregate = new Map();

  for (const line of Array.isArray(planLines) ? planLines : []) {
    const typeId = Number(line?.outputTypeId);
    const quantity = Number(line?.quantity);

    if (!Number.isFinite(typeId) || !Number.isInteger(typeId)) {
      continue;
    }

    if (!isValidQuantity(quantity)) {
      continue;
    }

    const currentQuantity = aggregate.get(typeId) || 0;
    aggregate.set(typeId, currentQuantity + quantity);
  }

  return Array.from(aggregate.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([typeId, quantity]) => ({ typeId, quantity }));
}

module.exports = {
  normalizePlanLines,
};
