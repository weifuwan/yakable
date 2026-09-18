import * as React from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return <SonnerToaster position="top-right" richColors closeButton {...props} />;
}

export { toast };
