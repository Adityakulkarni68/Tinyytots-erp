import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, arrayRemove, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppUser } from '../../types';

interface TeacherRow extends AppUser {
  classNames: string;
}

export default function AdminTeachersPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadData() {
    const [teacherSnaps, classSnaps] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      getDocs(collection(db, 'classes')),
    ]);

    const classMap: Record<string, string> = {};
    for (const d of classSnaps.docs) classMap[d.id] = d.data().name;

    const rows: TeacherRow[] = teacherSnaps.docs.map((d) => {
      const data = d.data();
      const classNames = (data.assignedClassIds as string[])
        .map((id) => classMap[id])
        .filter(Boolean)
        .join(', ');
      return { uid: d.id, ...data, classNames: classNames || '—' } as TeacherRow;
    });
    rows.sort((a, b) => a.displayName.localeCompare(b.displayName));

    setTeachers(rows);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function deleteTeacher(teacher: TeacherRow) {
    if (!confirm(`Remove ${teacher.displayName}? They will lose access to the app.`)) return;
    setDeletingId(teacher.uid);

    // Remove teacher from all assigned classes
    const batch = writeBatch(db);
    for (const classId of teacher.assignedClassIds) {
      batch.update(doc(db, 'classes', classId), { teacherIds: arrayRemove(teacher.uid) });
    }
    // Delete the Firestore user doc (blocks app access since auth check requires this doc)
    batch.delete(doc(db, 'users', teacher.uid));
    await batch.commit();

    await loadData();
    setDeletingId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
          <p className="text-slate-500 text-sm mt-1">{teachers.length} total</p>
        </div>
        <button
          onClick={() => navigate('/register')}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Add Teacher
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : teachers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm mb-3">No teachers yet.</p>
          <button
            onClick={() => navigate('/register')}
            className="text-sm text-primary-600 hover:underline font-medium"
          >
            Add your first teacher
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {teachers.map((t) => {
            const initials = t.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={t.uid} className="flex items-center gap-3 px-4 py-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-purple-700 font-bold text-sm">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{t.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{t.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5 sm:hidden">{t.classNames}</p>
                </div>
                <p className="text-sm text-slate-400 hidden sm:block truncate max-w-[140px]">{t.classNames}</p>
                <button
                  onClick={() => deleteTeacher(t)}
                  disabled={deletingId === t.uid}
                  className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors whitespace-nowrap px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 shrink-0"
                >
                  {deletingId === t.uid ? '...' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
