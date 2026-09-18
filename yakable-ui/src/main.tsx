import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/app/App';
import { ComposerRunControl } from '@/features/agent-run/components/ComposerRunControl';
import { startPreviewSelectionController } from '@/features/preview/preview-selection-controller';
import '@/app/styles/global.css';
import '@/app/styles/ambient.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ComposerRunControl />
  </React.StrictMode>,
);

startPreviewSelectionController();
