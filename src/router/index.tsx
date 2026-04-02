import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';
import Login from '../pages/Login';
import Register from '../pages/Register';
import TeacherDashboard from '../pages/teacher/Dashboard';
import AttendancePage from '../pages/teacher/AttendancePage';
import TeacherReportPage from '../pages/teacher/ReportPage';
import AdminDashboard from '../pages/admin/Dashboard';
import AdminClassesPage from '../pages/admin/ClassesPage';
import AdminStudentsPage from '../pages/admin/StudentsPage';
import AdminTeachersPage from '../pages/admin/TeachersPage';
import AdminAttendancePage from '../pages/admin/AttendancePage';
import PrincipalDashboard from '../pages/principal/Dashboard';
import PrincipalClassReportPage from '../pages/principal/ClassReportPage';

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
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'principal') return <Navigate to="/principal" replace />;
  return <Navigate to="/teacher" replace />;
}

function RequireAuth({ role }: { role?: 'teacher' | 'admin' | 'principal' }) {
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
  { path: '/register', element: <Register /> },
  {
    element: <RequireAuth role="teacher" />,
    children: [
      { path: '/teacher', element: <TeacherDashboard /> },
      { path: '/teacher/class/:classId', element: <AttendancePage /> },
      { path: '/teacher/class/:classId/report', element: <TeacherReportPage /> },
    ],
  },
  {
    element: <RequireAuth role="admin" />,
    children: [
      { path: '/admin', element: <AdminDashboard /> },
      { path: '/admin/classes', element: <AdminClassesPage /> },
      { path: '/admin/students', element: <AdminStudentsPage /> },
      { path: '/admin/teachers', element: <AdminTeachersPage /> },
      { path: '/admin/attendance', element: <AdminAttendancePage /> },
    ],
  },
  {
    element: <RequireAuth role="principal" />,
    children: [
      { path: '/principal', element: <PrincipalDashboard /> },
      { path: '/principal/class/:classId', element: <PrincipalClassReportPage /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
