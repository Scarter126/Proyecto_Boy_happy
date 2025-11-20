import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';

// Pages
import Home from './pages/Home';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import Anuncios from './pages/admin/Anuncios';
import Configuracion from './pages/admin/Configuracion';
import Materiales from './pages/admin/Materiales';
import Matriculas from './pages/admin/Matriculas';
import Asistencia from './pages/admin/Asistencia';
import Comparativo from './pages/admin/Comparativo';
import ProfesorDashboard from './pages/profesor/Dashboard';
import ProfesorAvanceAlumnos from './pages/profesor/AvanceAlumnos';
import ProfesorAsistencia from './pages/profesor/Asistencia';
import ProfesorCalendario from './pages/profesor/Calendario';
import ProfesorEvaluaciones from './pages/profesor/Evaluaciones';
import ProfesorMateriales from './pages/profesor/Materiales';
import ProfesorReportes from './pages/profesor/Reportes';
import FonoDashboard from './pages/fono/Dashboard';
import FonoAlumnos from './pages/fono/Alumnos';
import FonoAsistencia from './pages/fono/Asistencia';
import FonoCalendario from './pages/fono/Calendario';
import FonoEvaluaciones from './pages/fono/Evaluaciones';
import FonoMateriales from './pages/fono/Materiales';
import FonoReportes from './pages/fono/Reportes';
import FonoSesiones from './pages/fono/Sesiones';
import ApoderadoDashboard from './pages/apoderado/Dashboard';
import ApoderadoMisHijos from './pages/apoderado/MisHijos';
import ApoderadoAnuncios from './pages/apoderado/Anuncios';
import ApoderadoAsistencia from './pages/apoderado/Asistencia';
import ApoderadoCalendario from './pages/apoderado/Calendario';
import ApoderadoEvaluaciones from './pages/apoderado/Evaluaciones';
import ApoderadoMateriales from './pages/apoderado/Materiales';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import ProfesorLayout from './layouts/ProfesorLayout';
import FonoLayout from './layouts/FonoLayout';
import ApoderadoLayout from './layouts/ApoderadoLayout';

// Protected Route wrapper
function ProtectedRoute({ children, roles = [] }) {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  // Check token expiration inline (no extraer la función del store)
  const isTokenExpired = !user || !user.exp || Date.now() >= user.exp * 1000;

  // Check authentication
  const isAuthenticated = token && user && !isTokenExpired;

  if (!isAuthenticated) {
    // Redirigir a la raíz sin mostrar modal
    return <Navigate to="/" replace />;
  }

  // Check roles if specified
  if (roles.length > 0) {
    const userGroups = user?.['cognito:groups'] || [];
    const hasRequiredRole = roles.some(role => userGroups.includes(role));

    if (!hasRequiredRole) {
      // Redirigir a la raíz si no tiene el rol adecuado
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/home" element={<Home />} />
      <Route path="/" element={<Home />} />

      {/* Protected routes - Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="anuncios" element={<Anuncios />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="materiales" element={<Materiales />} />
        <Route path="matriculas" element={<Matriculas />} />
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="comparativo" element={<Comparativo />} />
      </Route>

      {/* Protected routes - Profesor */}
      <Route
        path="/profesor"
        element={
          <ProtectedRoute roles={['profesor']}>
            <ProfesorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProfesorDashboard />} />
        <Route path="avance-alumnos" element={<ProfesorAvanceAlumnos />} />
        <Route path="asistencia" element={<ProfesorAsistencia />} />
        <Route path="calendario" element={<ProfesorCalendario />} />
        <Route path="evaluaciones" element={<ProfesorEvaluaciones />} />
        <Route path="materiales" element={<ProfesorMateriales />} />
        <Route path="reportes" element={<ProfesorReportes />} />
      </Route>

      {/* Protected routes - Fono */}
      <Route
        path="/fono"
        element={
          <ProtectedRoute roles={['fono']}>
            <FonoLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FonoDashboard />} />
        <Route path="alumnos" element={<FonoAlumnos />} />
        <Route path="asistencia" element={<FonoAsistencia />} />
        <Route path="calendario" element={<FonoCalendario />} />
        <Route path="evaluaciones" element={<FonoEvaluaciones />} />
        <Route path="materiales" element={<FonoMateriales />} />
        <Route path="reportes" element={<FonoReportes />} />
        <Route path="sesiones" element={<FonoSesiones />} />
      </Route>

      {/* Protected routes - Apoderado */}
      <Route
        path="/apoderado"
        element={
          <ProtectedRoute roles={['apoderado']}>
            <ApoderadoLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ApoderadoDashboard />} />
        <Route path="mis-hijos" element={<ApoderadoMisHijos />} />
        <Route path="anuncios" element={<ApoderadoAnuncios />} />
        <Route path="asistencia" element={<ApoderadoAsistencia />} />
        <Route path="calendario" element={<ApoderadoCalendario />} />
        <Route path="evaluaciones" element={<ApoderadoEvaluaciones />} />
        <Route path="materiales" element={<ApoderadoMateriales />} />
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
              <p className="text-xl text-gray-600 mb-8">Página no encontrada</p>
              <a href="/" className="btn-primary">
                Volver al inicio
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default AppRouter;
