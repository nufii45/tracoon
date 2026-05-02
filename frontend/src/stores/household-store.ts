import { create } from 'zustand';
import type { HouseholdWithRole } from '@/types';

interface HouseholdState {
  currentHousehold: HouseholdWithRole | null;
  setCurrentHousehold: (household: HouseholdWithRole | null) => void;
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  currentHousehold: null,
  setCurrentHousehold: (household) => set({ currentHousehold: household }),
}));
