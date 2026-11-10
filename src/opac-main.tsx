import React from 'react';
import ReactDOM from 'react-dom/client';
import { OpacApp } from './opac/OpacApp';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { installStaleChunkReload } from './app/utils/staleChunkReload';
import { OpacEntrancePreloader } from './opac/OpacEntrancePreloader';

installStaleChunkReload();

function Root() {
  return (
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="عذراً، حدث خطأ في الفهرس">
        <OpacApp
          onOpenEditor={() => {
            window.location.href = '/moon/';
          }}
        />
        <OpacEntrancePreloader />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
