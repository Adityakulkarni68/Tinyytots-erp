import { useEffect, useState, type FormEvent } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Student, Class } from '../../types';

interface StudentRow extends Student {
  className: string;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadData() {
    const [studentSnaps, classSnaps] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'classes')),
    ]);

    const classMap: Record<string, string> = {};
    const classList: Class[] = [];
    for (const d of classSnaps.docs) {
      classMap[d.id] = d.data().name;
      classList.push({ id: d.id, ...d.data() } as Class);
    }

    const rows: StudentRow[] = studentSnaps.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      classId: d.data().classId,
      photoURL: d.data().photoURL,
      className: classMap[d.data().classId] ?? '—',
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));

    setStudents(rows);
    setClasses(classList);
    if (classList.length > 0 && !newClassId) setNewClassId(classList[0].id);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function addStudent(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newClassId) return;
    setSaving(true);
    const ref = await addDoc(collection(db, 'students'), { name: newName.trim(), classId: newClassId });
    // Update class's studentIds array
    await updateDoc(doc(db, 'classes', newClassId), { studentIds: arrayUnion(ref.id) });
    setNewName('');
    setShowForm(false);
    await loadData();
    setSaving(false);
  }

  async function removeStudent(student: StudentRow) {
    if (!confirm(`Remove ${student.name}? This cannot be undone.`)) return;
    setDeletingId(student.id);
    await deleteDoc(doc(db, 'students', student.id));
    await updateDoc(doc(db, 'classes', student.classId), { studentIds: arrayRemove(student.id) });
    await loadData();
    setDeletingId(null);
  }

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.className.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-500 text-sm mt-1">{students.length} total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Add Student
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">
            {students.length === 0 ? 'No students yet. Add your first student.' : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {filtered.map((s) => {
            const initials = s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-primary-700 font-bold text-xs">{initials}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.className}</p>
                </div>
                <button
                  onClick={() => removeStudent(s)}
                  disabled={deletingId === s.id}
                  className="text-sm text-red-500 hover:text-red-700 disabled:opacity-40 font-medium transition-colors"
                >
                  {deletingId === s.id ? '...' : 'Remove'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add student modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <form onSubmit={addStudent} className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add Student</h3>
            <div className="space-y-3 mb-5">
              <input
                autoFocus
                type="text"
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
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
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
