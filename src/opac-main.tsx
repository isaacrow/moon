import React from 'react';
import ReactDOM from 'react-dom/client';
import { OpacApp } from './opac/OpacApp';
import { ErrorBoundary } from './app/components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="تعذّر عرض الفهرس">
      <OpacApp
        onOpenEditor={() => {
          window.location.href = '/moon/';
        }}
      />
    </ErrorBoundary>
  </React.StrictMode>
);
