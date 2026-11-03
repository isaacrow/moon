import React from 'react';
import ReactDOM from 'react-dom/client';
import { WolfMoonStandaloneOpac } from './app/components/WolfMoonStandaloneOpac';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import './styles/index.css';
import './styles/glassmorphism.css';
import './styles/liquid-glass.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="WOF MOON OPAC Error">
      <WolfMoonStandaloneOpac
        onOpenEditor={() => {
          window.location.href = '/moon/';
        }}
      />
    </ErrorBoundary>
  </React.StrictMode>
);
