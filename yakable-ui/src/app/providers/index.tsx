import { StrictMode, type ReactNode } from 'react';

import { AuthProvider } from '@/features/auth';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <AuthProvider>{children}</AuthProvider>
    </StrictMode>
  );
}
