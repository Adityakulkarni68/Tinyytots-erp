import { useEffect, useState, type FormEvent } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, arrayUnion, arrayRemove, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Class, AppUser } from '../../types';

interface ClassRow extends Class {
  teacherNames: string;
}

interface ManageTeachersModalProps {
  cls: ClassRow;
  teachers: AppUser[];
  onClose: () => void;
  onSaved: () => void;
}

function ManageTeachersModal({ cls, teachers, onClose, onSaved }: ManageTeachersModalProps) {
  const assigned = teachers.filter((t) => cls.teacherIds.includes(t.uid));
  const available = teachers.filter((t) => !cls.teacherIds.includes(t.uid));
  const [saving, setSaving] = useState(false);

  async function addTeacher(teacherId: string) {
    setSaving(true);
    await Promise.all([
      updateDoc(doc(db, 'classes', cls.id), { teacherIds: arrayUnion(teacherId) }),
      updateDoc(doc(db, 'users', teacherId), { assignedClassIds: arrayUnion(cls.id) }),
    ]);
    setSaving(false);
    onSaved();
  }

  async function removeTeacher(teacherId: string) {
    setSaving(true);
    await Promise.all([
      updateDoc(doc(db, 'classes', cls.id), { teacherIds: arrayRemove(teacherId) }),
      updateDoc(doc(db, 'users', teacherId), { assignedClassIds: arrayRemove(cls.id) }),
    ]);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Manage Teachers</h3>
        <p className="text-sm text-slate-500 mb-4">{cls.name}</p>

        {/* Assigned teachers */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assigned</p>
          {assigned.length === 0 ? (
            <p className="text-sm text-slate-400">No teachers assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {assigned.map((t) => (
                <div key={t.uid} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-slate-800 font-medium">{t.displayName}</span>
                  <button
                    onClick={() => removeTeacher(t.uid)}
                    disabled={saving}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add teacher */}
        {available.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add Teacher</p>
            <div className="space-y-1">
              {available.map((t) => (
                <button
                  key={t.uid}
                  onClick={() => addTeacher(t.uid)}
                  disabled={saving}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40 transition-colors"
                >
                  + {t.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [managingClass, setManagingClass] = useState<ClassRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      const names = (data.teacherIds as string[])
        .map((id) => teacherMap[id])
        .filter(Boolean)
        .join(', ');
      return {
        id: d.id,
        name: data.name,
        teacherIds: data.teacherIds,
        studentIds: data.studentIds,
        teacherNames: names || '—',
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

  // Keep managingClass in sync after a save so the modal reflects latest state
  function handleTeacherSaved() {
    loadData().then(() => {
      if (managingClass) {
        setClasses((prev) => {
          const updated = prev.find((c) => c.id === managingClass.id);
          if (updated) setManagingClass(updated);
          return prev;
        });
      }
    });
  }

  async function deleteClass(cls: ClassRow) {
    if (!confirm(`Delete "${cls.name}"? This will also remove all its students and cannot be undone.`)) return;
    setDeletingId(cls.id);

    const batch = writeBatch(db);

    // Remove class from all assigned teachers
    for (const teacherId of cls.teacherIds) {
      batch.update(doc(db, 'users', teacherId), { assignedClassIds: arrayRemove(cls.id) });
    }

    // Delete all students in this class
    const studentSnaps = await getDocs(query(collection(db, 'students'), where('classId', '==', cls.id)));
    for (const s of studentSnaps.docs) batch.delete(s.ref);

    // Delete the class doc
    batch.delete(doc(db, 'classes', cls.id));

    await batch.commit();
    await loadData();
    setDeletingId(null);
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
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{cls.name}</p>
                <p className="text-sm text-slate-500">{cls.studentIds.length} students</p>
              </div>
              <div className="text-sm text-slate-500 truncate max-w-[160px] hidden sm:block">
                {cls.teacherNames}
              </div>
              <button
                onClick={() => setManagingClass(cls)}
                className="text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors whitespace-nowrap"
              >
                Manage Teachers
              </button>
              <button
                onClick={() => deleteClass(cls)}
                disabled={deletingId === cls.id}
                className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {deletingId === cls.id ? '...' : 'Delete'}
              </button>
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

      {/* Manage teachers modal */}
      {managingClass && (
        <ManageTeachersModal
          cls={managingClass}
          teachers={teachers}
          onClose={() => setManagingClass(null)}
          onSaved={handleTeacherSaved}
        />
      )}
    </div>
  );
}
