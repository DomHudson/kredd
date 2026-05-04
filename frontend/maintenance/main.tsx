import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import Maintenance from './Maintenance';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Maintenance />
  </StrictMode>,
);
