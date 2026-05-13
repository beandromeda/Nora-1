import { useContext } from 'react';
import { PlannerContext, type PlannerContextValue } from './plannerContextValue';

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider');
  return ctx;
}
