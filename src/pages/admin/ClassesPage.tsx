import { useEffect, useState, type FormEvent } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Class, AppUser } from '../../types';

interface ClassRow extends Class {
  teacherName: string;
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const [classSnaps, teacherSnaps] = await Promise.all([
      getDocs(collection(db, 'classes')),
      getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
    ]);

    const teacherMap: Record<string, string> = {};
    const teacherList: AppUser[] = [];
    for (const d of teacherSnaps.docs) {
      teacherMap[d.id] = d.data().displayName;
      teacherList.push({ uid: d.id, ...d.data() } as AppUser);
    }

    const rows: ClassRow[] = classSnaps.docs.map((d) => {
      const data = d.data();
      const firstTeacherId = (data.teacherIds as string[])[0];
      return {
        id: d.id,
        name: data.name,
        teacherIds: data.teacherIds,
        studentIds: data.studentIds,
        teacherName: firstTeacherId ? (teacherMap[firstTeacherId] ?? 'Unknown') : '—',
      };
    });

    setClasses(rows);
    setTeachers(teacherList);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function createClass(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await addDoc(collection(db, 'classes'), { name: newName.trim(), teacherIds: [], studentIds: [] });
    setNewName('');
    setShowForm(false);
    await loadData();
    setSaving(false);
  }

  async function assignTeacher(classId: string, teacherId: string) {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;

    // Remove this class from the previous teacher's assignedClassIds
    for (const prevTeacherId of cls.teacherIds) {
      const prevTeacher = teachers.find((t) => t.uid === prevTeacherId);
      if (prevTeacher) {
        await updateDoc(doc(db, 'users', prevTeacherId), {
          assignedClassIds: prevTeacher.assignedClassIds.filter((id) => id !== classId),
        });
      }
    }

    if (!teacherId) {
      await updateDoc(doc(db, 'classes', classId), { teacherIds: [] });
    } else {
      // Add class to new teacher's assignedClassIds
      const newTeacher = teachers.find((t) => t.uid === teacherId);
      if (newTeacher && !newTeacher.assignedClassIds.includes(classId)) {
        await updateDoc(doc(db, 'users', teacherId), {
          assignedClassIds: [...newTeacher.assignedClassIds, classId],
        });
      }
      await updateDoc(doc(db, 'classes', classId), { teacherIds: [teacherId] });
    }
    await loadData();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Classes</h1>
          <p className="text-slate-500 text-sm mt-1">{classes.length} total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Class
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">No classes yet. Create your first class.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {classes.map((cls) => (
            <div key={cls.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{cls.name}</p>
                <p className="text-sm text-slate-500">{cls.studentIds.length} students</p>
              </div>
              <select
                value={cls.teacherIds[0] ?? ''}
                onChange={(e) => assignTeacher(cls.id, e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700"
              >
                <option value="">No teacher</option>
                {teachers.map((t) => (
                  <option key={t.uid} value={t.uid}>{t.displayName}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* New class modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <form onSubmit={createClass} className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">New Class</h3>
            <input
              autoFocus
              type="text"
              placeholder="Class name (e.g. Nursery)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-semibold transition-colors"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
