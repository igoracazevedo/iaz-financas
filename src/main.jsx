import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
              <span>⚠️ Ocorreu um erro ao carregar a tela</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Seus dados continuam salvos com total segurança. Toque no botão abaixo para recarregar o aplicativo e limpar o cache.
            </p>
            <pre className="p-3 bg-slate-950 rounded-xl text-[11px] text-rose-300 font-mono overflow-x-auto max-h-36">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <button
              type="button"
              onClick={() => {
                if ('caches' in window) {
                  caches.keys().then((keys) =>
                    Promise.all(keys.map((k) => caches.delete(k)))
                  );
                }
                window.location.reload();
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition"
            >
              🔄 Recarregar e Atualizar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.update();
      })
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
