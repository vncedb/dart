import { useState } from 'react';

// Simplified hook without RevenueCat dependency
export function useProStatus() {
  // Always true or false depending on your preference. 
  // 'true' ensures UI doesn't lock features if logic remains elsewhere.
  const [isPro] = useState(true); 
  const [loading] = useState(false);

  return { isPro, loading };
}