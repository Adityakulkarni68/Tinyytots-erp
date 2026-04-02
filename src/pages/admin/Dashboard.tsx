import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

interface Stats {
  classes: number;
  teachers: number;
  students: number;
  submittedToday: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    async function load() {
      const [classesSnap, teachersSnap, studentsSnap, attendanceSnap] = await Promise.all([
        getCountFromServer(collection(db, 'classes')),
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'teacher'))),
        getCountFromServer(collection(db, 'students')),
        getDocs(query(collection(db, 'attendance'), where('date', '==', today))),
      ]);
      setStats({
        classes: classesSnap.data().count,
        teachers: teachersSnap.data().count,
        students: studentsSnap.data().count,
        submittedToday: attendanceSnap.size,
      });
    }
    load();
  }, [today]);

  const cards = stats
    ? [
        { label: 'Classes', value: stats.classes, path: '/admin/classes' },
        { label: 'Teachers', value: stats.teachers, path: null },
        { label: 'Students', value: stats.students, path: '/admin/students' },
      ]
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome back, {user?.displayName} — {format(new Date(), 'MMMM d, yyyy')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats === null
          ? [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 text-center animate-pulse">
                <div className="h-8 bg-slate-100 rounded w-12 mx-auto mb-2" />
                <div className="h-4 bg-slate-100 rounded w-20 mx-auto" />
              </div>
            ))
          : cards.map(({ label, value, path }) => (
              <button
                key={label}
                onClick={() => path && navigate(path)}
                className={`bg-white rounded-xl border border-slate-200 p-6 text-center transition-colors ${path ? 'hover:border-primary-300 hover:bg-primary-50 cursor-pointer' : 'cursor-default'}`}
              >
                <p className="text-3xl font-bold text-primary-600">{value}</p>
                <p className="text-sm text-slate-500 mt-1">{label}</p>
              </button>
            ))}
      </div>

      {stats !== null && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Today's Attendance</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary-600 h-3 rounded-full transition-all"
                style={{ width: stats.classes > 0 ? `${(stats.submittedToday / stats.classes) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-sm text-slate-600 font-medium whitespace-nowrap">
              {stats.submittedToday} / {stats.classes} classes submitted
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
