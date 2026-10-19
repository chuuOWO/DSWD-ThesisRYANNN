import { normalizeCategoryName } from './lguSync';

export type CommodityTypeFilter = 'All' | 'Food Items' | 'Non-Food Items';

/**
 * Checks if a commodity category qualifies as a Food Item.
 * Definition: Family Food Pack and Ready-to-Eat Food (RTEF) are Food Items.
 * All other commodities are Non-Food Items.
 */
export function isFoodItem(category?: string | null): boolean {
  if (!category) return false;
  const canonical = normalizeCategoryName(category);
  if (canonical === 'Family Food Pack' || canonical === 'Ready-to-Eat Food (RTEF)') {
    return true;
  }
  const c = category.trim().toLowerCase();
  return c.includes('food') || c.includes('rtef') || c.includes('ffp') || c.includes('ready-to-eat');
}

/**
 * Checks if a commodity category qualifies as a Non-Food Item (NFIs).
 */
export function isNonFoodItem(category?: string | null): boolean {
  if (!category) return false;
  return !isFoodItem(category);
}

/**
 * Evaluates whether a commodity matches the selected filter.
 */
export function matchesCommodityFilter(category?: string | null, filter?: string | null): boolean {
  if (!filter || filter === 'All' || filter === 'all' || filter === 'ALL') return true;
  if (filter === 'Food Items' || filter === 'Food Item' || filter === 'Food' || filter === 'food') {
    return isFoodItem(category);
  }
  if (filter === 'Non-Food Items' || filter === 'Non-Food Item' || filter === 'Non-Food' || filter === 'non-food' || filter === 'NFI') {
    return isNonFoodItem(category);
  }
  // If specific category is selected
  const canonicalFilter = normalizeCategoryName(filter);
  const canonicalCat = normalizeCategoryName(category);
  if (canonicalFilter && canonicalCat) {
    return canonicalFilter.toLowerCase() === canonicalCat.toLowerCase();
  }
  return (category || '').trim().toLowerCase() === filter.trim().toLowerCase();
}

/**
 * Splits warehouse capacity into Food Items capacity (60%) and Non-Food Items capacity (40%).
 */
export function getWarehouseCapacities(capacityPacks: number = 50000) {
  const total = Math.max(0, Number(capacityPacks) || 50000);
  const food = Math.round(total * 0.6);
  const nonFood = Math.max(0, total - food);

  return {
    total,
    food,
    nonFood,
    forFilter: (filter?: string | null) => {
      if (filter === 'Food Items' || filter === 'Food' || filter === 'food') return food;
      if (filter === 'Non-Food Items' || filter === 'Non-Food' || filter === 'non-food') return nonFood;
      return total;
    }
  };
}

/**
 * Splits LGU storage buffer capacity into Food Items capacity (60%) and Non-Food Items capacity (40%).
 */
export function getLguCapacities(maxStock: number = 3000) {
  const total = Math.max(0, Number(maxStock) || 3000);
  const food = Math.round(total * 0.6);
  const nonFood = Math.max(0, total - food);

  return {
    total,
    food,
    nonFood,
    forFilter: (filter?: string | null) => {
      if (filter === 'Food Items' || filter === 'Food' || filter === 'food') return food;
      if (filter === 'Non-Food Items' || filter === 'Non-Food' || filter === 'non-food') return nonFood;
      return total;
    }
  };
}

/**
 * Aggregates on-hand stock for an LGU by commodity group.
 */
export function getLguCommodityStock(lgu: {
  currentStock?: Record<string, number>;
  foodPacks?: number;
  rtef?: number;
  hygieneKits?: number;
  familyKits?: number;
  sleepingKits?: number;
  kitchenKits?: number;
  laminatedSacks?: number;
} | null | undefined) {
  if (!lgu) return { food: 0, nonFood: 0, total: 0 };

  const raw = lgu.currentStock || {};
  let food = 0;
  let nonFood = 0;

  if (Object.keys(raw).length > 0) {
    Object.entries(raw).forEach(([cat, val]) => {
      const num = Number(val) || 0;
      if (isFoodItem(cat)) food += num;
      else nonFood += num;
    });
  } else {
    food = (Number(lgu.foodPacks) || 0) + (Number(lgu.rtef) || 0);
    nonFood =
      (Number(lgu.hygieneKits) || 0) +
      (Number(lgu.familyKits) || 0) +
      (Number(lgu.sleepingKits) || 0) +
      (Number(lgu.kitchenKits) || 0) +
      (Number(lgu.laminatedSacks) || 0);
  }

  return {
    food,
    nonFood,
    total: food + nonFood,
    forFilter: (filter?: string | null) => {
      if (filter === 'Food Items' || filter === 'Food' || filter === 'food') return food;
      if (filter === 'Non-Food Items' || filter === 'Non-Food' || filter === 'non-food') return nonFood;
      return food + nonFood;
    }
  };
}

