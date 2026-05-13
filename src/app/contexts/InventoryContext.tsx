import { createContext, useContext, useState, ReactNode } from 'react';

interface InventoryItem {
  category: string;
  warehouseA: number;
  warehouseB: number;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  addStock: (category: string, warehouse: 'Warehouse A' | 'Warehouse B', quantity: number) => void;
  deductStock: (category: string, warehouse: 'Warehouse A' | 'Warehouse B', quantity: number) => boolean;
  getAvailableStock: (category: string, warehouse: 'Warehouse A' | 'Warehouse B') => number;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { category: 'Food Pack', warehouseA: 1500, warehouseB: 1200 },
    { category: 'Hygiene Kit', warehouseA: 800, warehouseB: 500 },
    { category: 'Sleeping Kit', warehouseA: 400, warehouseB: 300 },
    { category: 'Kitchen Kit', warehouseA: 300, warehouseB: 200 },
    { category: 'Family Kit', warehouseA: 600, warehouseB: 400 },
    { category: 'Laminated Sack', warehouseA: 2000, warehouseB: 1500 },
    { category: 'RTEF', warehouseA: 250, warehouseB: 150 }
  ]);

  const addStock = (category: string, warehouse: 'Warehouse A' | 'Warehouse B', quantity: number) => {
    setInventory(prev => {
      const existingItem = prev.find(item => item.category === category);

      if (existingItem) {
        return prev.map(item =>
          item.category === category
            ? {
                ...item,
                warehouseA: warehouse === 'Warehouse A' ? item.warehouseA + quantity : item.warehouseA,
                warehouseB: warehouse === 'Warehouse B' ? item.warehouseB + quantity : item.warehouseB
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            category,
            warehouseA: warehouse === 'Warehouse A' ? quantity : 0,
            warehouseB: warehouse === 'Warehouse B' ? quantity : 0
          }
        ];
      }
    });
  };

  const deductStock = (category: string, warehouse: 'Warehouse A' | 'Warehouse B', quantity: number): boolean => {
    const item = inventory.find(i => i.category === category);
    if (!item) return false;

    const currentStock = warehouse === 'Warehouse A' ? item.warehouseA : item.warehouseB;

    // Check if we have enough stock
    if (currentStock < quantity) {
      return false;
    }

    setInventory(prev =>
      prev.map(item =>
        item.category === category
          ? {
              ...item,
              warehouseA: warehouse === 'Warehouse A' ? item.warehouseA - quantity : item.warehouseA,
              warehouseB: warehouse === 'Warehouse B' ? item.warehouseB - quantity : item.warehouseB
            }
          : item
      )
    );

    return true;
  };

  const getAvailableStock = (category: string, warehouse: 'Warehouse A' | 'Warehouse B'): number => {
    const item = inventory.find(i => i.category === category);
    if (!item) return 0;

    return warehouse === 'Warehouse A' ? item.warehouseA : item.warehouseB;
  };

  return (
    <InventoryContext.Provider value={{ inventory, addStock, deductStock, getAvailableStock }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    // Fallback for when context is not available
    console.warn('useInventory called outside of InventoryProvider, using fallback');
    return {
      inventory: [
        { category: 'Food Pack', warehouseA: 1500, warehouseB: 1200 },
        { category: 'Hygiene Kit', warehouseA: 800, warehouseB: 500 },
        { category: 'Sleeping Kit', warehouseA: 400, warehouseB: 300 },
        { category: 'Kitchen Kit', warehouseA: 300, warehouseB: 200 },
        { category: 'Family Kit', warehouseA: 600, warehouseB: 400 },
        { category: 'Laminated Sack', warehouseA: 2000, warehouseB: 1500 },
        { category: 'RTEF', warehouseA: 250, warehouseB: 150 }
      ],
      addStock: () => {},
      deductStock: () => false,
      getAvailableStock: () => 0
    };
  }
  return context;
}
