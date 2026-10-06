/**
 * System Logic for Priority Indicators
 * Implements Table 1: System Logic for Priority Indicators
 *
 * Completion/Stock Rate | Indicator Color | Priority Level | System Response
 * Below 25%             | Red             | Severe         | Immediate Dispatch
 * Below 50%             | Orange          | Low            | Immediate Dispatch / Emergency Flag
 * Lower than 75%        | Yellow          | Medium         | Active Monitoring / Scheduled Dispatch
 * Above 76%             | Green           | Adequate       | Standard Monitoring / Low Priority
 */

export type PriorityColor = 'Red' | 'Orange' | 'Yellow' | 'Green';
export type PriorityLevel = 'Severe' | 'Low' | 'Medium' | 'Adequate';

export interface PriorityIndicatorConfig {
  completionRateRange: string;
  color: PriorityColor;
  priorityLevel: PriorityLevel;
  systemResponse: string;
  badgeClasses: string;
  pillClasses: string;
  borderClasses: string;
  bgClasses: string;
  textClasses: string;
  hexColor: string;
}

export const PRIORITY_TABLE_LOGIC: PriorityIndicatorConfig[] = [
  {
    completionRateRange: 'Below 25%',
    color: 'Red',
    priorityLevel: 'Severe',
    systemResponse: 'Immediate Dispatch',
    badgeClasses: 'bg-red-100 text-red-800 border-red-200',
    pillClasses: 'bg-red-600 text-white',
    borderClasses: 'border-red-200',
    bgClasses: 'bg-red-50/70',
    textClasses: 'text-red-700',
    hexColor: '#dc2626'
  },
  {
    completionRateRange: 'Below 50%',
    color: 'Orange',
    priorityLevel: 'Low',
    systemResponse: 'Immediate Dispatch / Emergency Flag',
    badgeClasses: 'bg-orange-100 text-orange-800 border-orange-200',
    pillClasses: 'bg-orange-600 text-white',
    borderClasses: 'border-orange-200',
    bgClasses: 'bg-orange-50/70',
    textClasses: 'text-orange-700',
    hexColor: '#ea580c'
  },
  {
    completionRateRange: 'Lower than 75%',
    color: 'Yellow',
    priorityLevel: 'Medium',
    systemResponse: 'Active Monitoring / Scheduled Dispatch',
    badgeClasses: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pillClasses: 'bg-yellow-600 text-white',
    borderClasses: 'border-yellow-200',
    bgClasses: 'bg-yellow-50/70',
    textClasses: 'text-yellow-700',
    hexColor: '#ca8a04'
  },
  {
    completionRateRange: 'Above 76%',
    color: 'Green',
    priorityLevel: 'Adequate',
    systemResponse: 'Standard Monitoring / Low Priority',
    badgeClasses: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pillClasses: 'bg-emerald-600 text-white',
    borderClasses: 'border-emerald-200',
    bgClasses: 'bg-emerald-50/70',
    textClasses: 'text-emerald-700',
    hexColor: '#16a34a'
  }
];

export const TARGET_BASELINE_STOCK = 400; // Municipal emergency buffer quota standard

export interface PriorityEvaluation {
  stockRate: number; // 0 to 100%
  completionRate: number; // 0 to 100%
  effectiveRate: number; // The active Completion/Stock Rate
  priorityColor: PriorityColor;
  priorityLevel: PriorityLevel;
  systemResponse: string;
  config: PriorityIndicatorConfig;
  urgencyScore: number;
}

export function evaluatePriorityIndicator(params: {
  foodPacks?: number;
  totalStock?: number;
  targetQuota?: number;
  completedDeliveries?: number;
  pendingDeliveries?: number;
  totalDeliveries?: number;
  affectedFamilies?: number;
}): PriorityEvaluation {
  const target = params.targetQuota && params.targetQuota > 0 ? params.targetQuota : TARGET_BASELINE_STOCK;
  const fp = Math.max(0, params.foodPacks ?? 0);

  // 1. Stock Rate vs Target Buffer
  const stockRate = Math.min(100, Math.max(0, Math.round((fp / target) * 100)));

  // 2. Delivery Completion Rate (if dispatches exist)
  const completed = params.completedDeliveries ?? 0;
  const pending = params.pendingDeliveries ?? 0;
  const totalDeliveries = (params.totalDeliveries && params.totalDeliveries > 0)
    ? params.totalDeliveries
    : (completed + pending);

  const completionRate = totalDeliveries > 0
    ? Math.min(100, Math.max(0, Math.round((completed / totalDeliveries) * 100)))
    : stockRate;

  // 3. Effective Completion/Stock Rate:
  // If active dispatches exist, a bottleneck in deliveries or low stock dictates the rate
  const effectiveRate = totalDeliveries > 0 ? Math.min(stockRate, completionRate) : stockRate;

  // 4. Match against Table 1 logic:
  let matchedConfig: PriorityIndicatorConfig;
  if (effectiveRate < 25) {
    matchedConfig = PRIORITY_TABLE_LOGIC[0]; // Red / Severe
  } else if (effectiveRate < 50) {
    matchedConfig = PRIORITY_TABLE_LOGIC[1]; // Orange / Low
  } else if (effectiveRate < 75) {
    matchedConfig = PRIORITY_TABLE_LOGIC[2]; // Yellow / Medium
  } else {
    matchedConfig = PRIORITY_TABLE_LOGIC[3]; // Green / Adequate
  }

  // Numerical urgency score for fine sorting (0 to 100):
  // Lower stock/completion rate generates higher urgency
  const demandPenalty = Math.min(20, Math.round((params.affectedFamilies ?? 0) / 40));
  const pendingPenalty = Math.min(15, pending * 3);
  const urgencyScore = Math.min(100, Math.max(0, Math.round((100 - effectiveRate) * 0.8 + demandPenalty + pendingPenalty)));

  return {
    stockRate,
    completionRate,
    effectiveRate,
    priorityColor: matchedConfig.color,
    priorityLevel: matchedConfig.priorityLevel,
    systemResponse: matchedConfig.systemResponse,
    config: matchedConfig,
    urgencyScore
  };
}
