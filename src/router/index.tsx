import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';
import Login from '../pages/Login';
import TeacherDashboard from '../pages/teacher/Dashboard';
import AttendancePage from '../pages/teacher/AttendancePage';
import AdminDashboard from '../pages/admin/Dashboard';
import AdminClassesPage from '../pages/admin/ClassesPage';
import AdminStudentsPage from '../pages/admin/StudentsPage';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-400 text-sm">Loading...</p>
    </div>
  );
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/teacher'} replace />;
}

function RequireAuth({ role }: { role?: 'teacher' | 'admin' }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <RoleRedirect /> },
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth role="teacher" />,
    children: [
      { path: '/teacher', element: <TeacherDashboard /> },
      { path: '/teacher/class/:classId', element: <AttendancePage /> },
    ],
  },
  {
    element: <RequireAuth role="admin" />,
    children: [
      { path: '/admin', element: <AdminDashboard /> },
      { path: '/admin/classes', element: <AdminClassesPage /> },
      { path: '/admin/students', element: <AdminStudentsPage /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
