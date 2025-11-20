import { useEffect, useState } from 'preact/hooks';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import AppRouter from './router';
import useAuthStore from './stores/authStore';
import { queryClient } from './lib/queryClient';
import DevPanel from './components/dev/DevPanel';

function App() {
  const init = useAuthStore(state => state.init);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Inicializar auth store al montar la app
    const initializeAuth = async () => {
      try {
        await init();
      } catch (error) {
        console.error('Error al inicializar autenticación:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [init]);

  // Mostrar un loader mientras se inicializa la sesión
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
        <DevPanel />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
