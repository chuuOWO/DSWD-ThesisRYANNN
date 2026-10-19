import { normalizeCategoryName } from './lguSync';

export type CommodityTypeFilter = 'All' | 'Food Items' | 'Non-Food Items';

export interface WarehouseCapacityConfig {
  food: number;
  nonFood: number;
  total: number;
}

export interface LguCapacityConfig {
  food: number;
  nonFood: number;
  total: number;
}

const WAREHOUSE_STORAGE_KEY = 'dswd_custom_warehouse_capacities';
const LGU_STORAGE_KEY = 'dswd_custom_lgu_capacities';

// Known initial defaults if no user input has been saved yet
const DEFAULT_WAREHOUSE_PRESETS: Record<string, { food: number; nonFood: number }> = {
  'wh-oton': { food: 60000, nonFood: 40000 },
  'oton': { food: 60000, nonFood: 40000 },
  'wh-pototan': { food: 48000, nonFood: 32000 },
  'pototan': { food: 48000, nonFood: 32000 }
};

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
  const canonicalFilter = normalizeCategoryName(filter);
  const canonicalCat = normalizeCategoryName(category);
  if (canonicalFilter && canonicalCat) {
    return canonicalFilter.toLowerCase() === canonicalCat.toLowerCase();
  }
  return (category || '').trim().toLowerCase() === filter.trim().toLowerCase();
}

/**
 * Retrieves user-configured warehouse capacity for food and non-food items.
 */
export function getStoredWarehouseCapacities(idOrName?: string, defaultTotal?: number): WarehouseCapacityConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const key = (idOrName || '').trim().toLowerCase();
        if (parsed[key]) {
          const f = Math.max(0, Number(parsed[key].food) || 0);
          const nf = Math.max(0, Number(parsed[key].nonFood) || 0);
          return { food: f, nonFood: nf, total: f + nf };
        }
        // Also check if key matches any stored partial name
        for (const [storedKey, val] of Object.entries(parsed)) {
          if (storedKey && key && (key.includes(storedKey) || storedKey.includes(key))) {
            const castVal = val as { food?: number; nonFood?: number };
            const f = Math.max(0, Number(castVal.food) || 0);
            const nf = Math.max(0, Number(castVal.nonFood) || 0);
            return { food: f, nonFood: nf, total: f + nf };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback to presets or total
  const key = (idOrName || '').trim().toLowerCase();
  for (const [k, v] of Object.entries(DEFAULT_WAREHOUSE_PRESETS)) {
    if (key.includes(k)) {
      return { food: v.food, nonFood: v.nonFood, total: v.food + v.nonFood };
    }
  }

  const tot = Math.max(0, Number(defaultTotal) || 50000);
  const f = Math.round(tot * 0.5);
  return { food: f, nonFood: tot - f, total: tot };
}

/**
 * Persists user-configured warehouse capacity for food and non-food items.
 */
export function saveWarehouseCapacities(idOrName: string, food: number, nonFood: number): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
    const map = stored ? JSON.parse(stored) : {};
    const key = idOrName.trim().toLowerCase();
    const cleanFood = Math.max(0, Math.round(food));
    const cleanNonFood = Math.max(0, Math.round(nonFood));
    map[key] = { food: cleanFood, nonFood: cleanNonFood, total: cleanFood + cleanNonFood };
    localStorage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('dswd_capacities_updated'));
  } catch {
    // ignore
  }
}

/**
 * Retrieves user-configured LGU capacity for food and non-food items.
 */
export function getStoredLguCapacities(idOrMuni?: string, defaultMaxStock?: number): LguCapacityConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LGU_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const key = (idOrMuni || '').trim().toLowerCase();
        if (parsed[key]) {
          const f = Math.max(0, Number(parsed[key].food) || 0);
          const nf = Math.max(0, Number(parsed[key].nonFood) || 0);
          return { food: f, nonFood: nf, total: f + nf };
        }
        for (const [storedKey, val] of Object.entries(parsed)) {
          if (storedKey && key && (key.includes(storedKey) || storedKey.includes(key))) {
            const castVal = val as { food?: number; nonFood?: number };
            const f = Math.max(0, Number(castVal.food) || 0);
            const nf = Math.max(0, Number(castVal.nonFood) || 0);
            return { food: f, nonFood: nf, total: f + nf };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const tot = Math.max(0, Number(defaultMaxStock) || 3000);
  const f = Math.round(tot * 0.6);
  const nf = Math.max(0, tot - f);
  return { food: f, nonFood: nf, total: tot };
}

/**
 * Persists user-configured LGU capacity for food and non-food items.
 */
export function saveLguCapacities(idOrMuni: string, food: number, nonFood: number): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(LGU_STORAGE_KEY);
    const map = stored ? JSON.parse(stored) : {};
    const key = idOrMuni.trim().toLowerCase();
    const cleanFood = Math.max(0, Math.round(food));
    const cleanNonFood = Math.max(0, Math.round(nonFood));
    map[key] = { food: cleanFood, nonFood: cleanNonFood, total: cleanFood + cleanNonFood };
    localStorage.setItem(LGU_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('dswd_capacities_updated'));
  } catch {
    // ignore
  }
}

/**
 * Calculates warehouse capacity for food and non-food based on user configuration.
 */
export function getWarehouseCapacities(target?: { id?: string; name?: string; capacityPacks?: number; foodCapacity?: number; nonFoodCapacity?: number } | number) {
  let food = 0;
  let nonFood = 0;
  let total = 0;

  if (typeof target === 'object' && target !== null) {
    if (target.foodCapacity !== undefined && target.nonFoodCapacity !== undefined) {
      food = Math.max(0, Number(target.foodCapacity) || 0);
      nonFood = Math.max(0, Number(target.nonFoodCapacity) || 0);
      total = food + nonFood;
    } else {
      const stored = getStoredWarehouseCapacities(target.id || target.name, target.capacityPacks);
      food = stored.food;
      nonFood = stored.nonFood;
      total = stored.total;
    }
  } else if (typeof target === 'number') {
    if (target === 100000) {
      const stored = getStoredWarehouseCapacities('wh-oton', 100000);
      food = stored.food;
      nonFood = stored.nonFood;
      total = stored.total;
    } else if (target === 80000) {
      const stored = getStoredWarehouseCapacities('wh-pototan', 80000);
      food = stored.food;
      nonFood = stored.nonFood;
      total = stored.total;
    } else {
      const stored = getStoredWarehouseCapacities(undefined, target);
      food = stored.food;
      nonFood = stored.nonFood;
      total = stored.total;
    }
  } else {
    food = 50000;
    nonFood = 50000;
    total = 100000;
  }

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
 * Calculates LGU capacity for food and non-food based on user configuration.
 */
export function getLguCapacities(target?: { id?: string; municipality?: string; maxStock?: number; foodCapacity?: number; nonFoodCapacity?: number } | number) {
  let food = 0;
  let nonFood = 0;
  let total = 0;

  if (typeof target === 'object' && target !== null) {
    if (target.foodCapacity !== undefined && target.nonFoodCapacity !== undefined) {
      food = Math.max(0, Number(target.foodCapacity) || 0);
      nonFood = Math.max(0, Number(target.nonFoodCapacity) || 0);
      total = food + nonFood;
    } else {
      const stored = getStoredLguCapacities(target.id || target.municipality, target.maxStock);
      food = stored.food;
      nonFood = stored.nonFood;
      total = stored.total;
    }
  } else if (typeof target === 'number') {
    const stored = getStoredLguCapacities(undefined, target);
    food = stored.food;
    nonFood = stored.nonFood;
    total = stored.total;
  } else {
    food = 2000;
    nonFood = 1000;
    total = 3000;
  }

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
  if (!lgu) return { food: 0, nonFood: 0, total: 0, forFilter: () => 0 };

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
