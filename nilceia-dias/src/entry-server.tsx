import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export function render(pageKey: string) {
  return renderToString(
    <StrictMode>
      <App pageKey={pageKey} />
    </StrictMode>,
  );
}
