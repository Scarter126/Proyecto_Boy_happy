import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import apiClient from '../lib/apiClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successSent, setSuccessSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Redirect if user is already authenticated
  useEffect(() => {
    if (token && user) {
      const roleRoutes = {
        admin: '/admin',
        profesor: '/profesor',
        fono: '/fono',
        apoderado: '/apoderado',
      };
      const userGroups = user['cognito:groups'] || [];
      const role = userGroups[0];
      const route = roleRoutes[role] || '/';
      navigate(route);
    }
  }, [token, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await apiClient.post('/recuperar-password', {
        correo: email,
      });

      if (response.success || response.message) {
        setSuccessSent(true);
      } else {
        setErrorMessage(response.error || 'Error al enviar correo');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage(
        error.response?.data?.error || 'Error de conexión. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getBackLink = () => {
    if (token && user) {
      const roleRoutes = {
        admin: '/admin',
        profesor: '/profesor',
        fono: '/fono',
        apoderado: '/apoderado',
      };
      const userGroups = user['cognito:groups'] || [];
      const role = userGroups[0];
      return roleRoutes[role] || '/';
    }
    return '/';
  };

  const getBackText = () => {
    return token && user ? 'Ir a mi panel' : 'Volver al inicio';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-indigo-100 mb-4">
              <i className="fas fa-key text-3xl text-indigo-600"></i>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Boy Happy</h1>
            <p className="text-gray-600">Recuperación de Contraseña</p>
          </div>

          {/* Request Form */}
          {!successSent && (
            <>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <i className="fas fa-info-circle mr-2"></i>
                  Ingresa tu correo electrónico y te enviaremos un enlace para
                  recuperar tu contraseña.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.correo@example.com"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <i className="fas fa-exclamation-circle mr-2"></i>
                      {errorMessage}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane mr-2"></i>
                      Enviar Enlace de Recuperación
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to={getBackLink()}
                  className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  {getBackText()}
                </Link>
              </div>
            </>
          )}

          {/* Success Message */}
          {successSent && (
            <>
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  <i className="fas fa-check-circle mr-2"></i>
                  ¡Correo enviado exitosamente!
                </p>
              </div>

              <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Próximos pasos:
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <i className="fas fa-envelope text-indigo-600 mt-1 mr-3"></i>
                    <span>Revisa tu bandeja de entrada</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fas fa-mouse-pointer text-indigo-600 mt-1 mr-3"></i>
                    <span>Haz clic en el enlace que recibiste</span>
                  </li>
                  <li className="flex items-start">
                    <i className="fas fa-clock text-indigo-600 mt-1 mr-3"></i>
                    <span>El enlace expirará en 24 horas</span>
                  </li>
                </ul>
              </div>

              <div className="text-center">
                <Link
                  to={getBackLink()}
                  className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  {getBackText()}
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Additional Help */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            ¿Necesitas ayuda?{' '}
            <a
              href="mailto:soporte@boyhappy.cl"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Contáctanos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
