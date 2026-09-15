import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { ComposerRunControl } from './components/ComposerRunControl';
import { startPreviewSelectionController } from './preview-selection-controller';
import './styles.css';
import './ambient.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ComposerRunControl />
  </React.StrictMode>,
);

startPreviewSelectionController();
