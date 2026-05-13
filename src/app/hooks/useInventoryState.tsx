import { useState } from 'react';

export interface InventoryItem {
  category: string;
  warehouseA: number;
  warehouseB: number;
}

export function useInventoryState() {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { category: 'Food Pack', warehouseA: 1500, warehouseB: 1200 },
    { category: 'Hygiene Kit', warehouseA: 800, warehouseB: 500 },
    { category: 'Sleeping Kit', warehouseA: 400, warehouseB: 300 },
    { category: 'Kitchen Kit', warehouseA: 300, warehouseB: 200 },
    { category: 'Family Kit', warehouseA: 600, warehouseB: 400 },
    { category: 'Laminated Sack', warehouseA: 2000, warehouseB: 1500 },
    { category: 'RTEF', warehouseA: 250, warehouseB: 150 }
  ]);

  const addStock = (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => {
    setInventory(prev => {
      const existingItem = prev.find(item => item.category === category);

      if (existingItem) {
        return prev.map(item =>
          item.category === category
            ? {
                ...item,
                warehouseA: warehouse === 'Oton Main Warehouse' ? item.warehouseA + quantity : item.warehouseA,
                warehouseB: warehouse === 'Pototan Main Warehouse' ? item.warehouseB + quantity : item.warehouseB
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            category,
            warehouseA: warehouse === 'Oton Main Warehouse' ? quantity : 0,
            warehouseB: warehouse === 'Pototan Main Warehouse' ? quantity : 0
          }
        ];
      }
    });
  };

  const deductStock = (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number): boolean => {
    const item = inventory.find(i => i.category === category);
    if (!item) return false;

    const currentStock = warehouse === 'Oton Main Warehouse' ? item.warehouseA : item.warehouseB;

    if (currentStock < quantity) {
      return false;
    }

    setInventory(prev =>
      prev.map(item =>
        item.category === category
          ? {
              ...item,
              warehouseA: warehouse === 'Oton Main Warehouse' ? item.warehouseA - quantity : item.warehouseA,
              warehouseB: warehouse === 'Pototan Main Warehouse' ? item.warehouseB - quantity : item.warehouseB
            }
          : item
      )
    );

    return true;
  };

  const getAvailableStock = (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse'): number => {
    const item = inventory.find(i => i.category === category);
    if (!item) return 0;

    return warehouse === 'Oton Main Warehouse' ? item.warehouseA : item.warehouseB;
  };

  return {
    inventory,
    addStock,
    deductStock,
    getAvailableStock
  };
}
