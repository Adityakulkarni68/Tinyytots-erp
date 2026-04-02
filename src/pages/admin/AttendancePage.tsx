import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { format, subDays, addDays, isToday, parseISO } from 'date-fns';
import { db } from '../../firebase/config';
import type { Class, Student, AttendanceStatus } from '../../types';

type Statuses = Record<string, AttendanceStatus>;

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'late'];
const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 border-green-200 text-green-700',
  absent:  'bg-red-100 border-red-200 text-red-600',
  late:    'bg-amber-100 border-amber-200 text-amber-700',
};
const STATUS_LABEL: Record<AttendanceStatus, string> = { present: 'Present', absent: 'Absent', late: 'Late' };

function nextStatus(s: AttendanceStatus): AttendanceStatus {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];
}

export default function AdminAttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Statuses>({});
  const [hasRecord, setHasRecord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  // Load classes once
  useEffect(() => {
    getDocs(collection(db, 'classes')).then((snaps) => {
      const list = snaps.docs.map((d) => ({ id: d.id, ...d.data() } as Class));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].id);
    });
  }, []);

  // Load students + attendance when class or date changes
  useEffect(() => {
    if (!selectedClassId) return;
    setLoading(true);
    setSearch('');

    Promise.all([
      getDocs(query(collection(db, 'students'), where('classId', '==', selectedClassId))),
      getDoc(doc(db, 'attendance', `${selectedClassId}_${selectedDate}`)),
    ]).then(([studentSnaps, attendanceSnap]) => {
      const loaded: Student[] = studentSnaps.docs
        .map((d) => ({ id: d.id, name: d.data().name, classId: d.data().classId } as Student))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(loaded);

      if (attendanceSnap.exists()) {
        setStatuses(attendanceSnap.data().entries as Statuses);
        setHasRecord(true);
      } else {
        // Default all to present
        const defaults: Statuses = {};
        for (const s of loaded) defaults[s.id] = 'present';
        setStatuses(defaults);
        setHasRecord(false);
      }
      setLoading(false);
    });
  }, [selectedClassId, selectedDate]);

  const filtered = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search],
  );

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0 };
    for (const s of students) c[statuses[s.id] ?? 'present']++;
    return c;
  }, [statuses, students]);

  function toggle(id: string) {
    setStatuses((prev) => ({ ...prev, [id]: nextStatus(prev[id] ?? 'present') }));
  }

  function resetAll() {
    const all: Statuses = {};
    for (const s of students) all[s.id] = 'present';
    setStatuses(all);
  }

  async function saveAttendance() {
    if (!selectedClassId) return;
    setSaving(true);
    const finalCounts = { present: 0, absent: 0, late: 0 };
    for (const s of students) finalCounts[statuses[s.id] ?? 'present']++;
    await setDoc(doc(db, 'attendance', `${selectedClassId}_${selectedDate}`), {
      date: selectedDate,
      classId: selectedClassId,
      teacherId: 'admin',
      submittedAt: serverTimestamp(),
      entries: statuses,
      counts: finalCounts,
    });
    setHasRecord(true);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function deleteRecord() {
    if (!confirm('Delete this attendance record? This cannot be undone.')) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'attendance', `${selectedClassId}_${selectedDate}`));
    const defaults: Statuses = {};
    for (const s of students) defaults[s.id] = 'present';
    setStatuses(defaults);
    setHasRecord(false);
    setDeleting(false);
  }

  const isFuture = selectedDate > format(new Date(), 'yyyy-MM-dd');
  const viewingToday = isToday(parseISO(selectedDate));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance Management</h1>
        <p className="text-slate-400 text-sm mt-0.5">View, edit or reset attendance for any class and date</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-5 flex flex-col sm:flex-row gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Date picker with nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >‹</button>
          <input
            type="date"
            value={selectedDate}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
          />
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            disabled={viewingToday}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-30"
          >›</button>
        </div>
      </div>

      {/* Status badge */}
      {!loading && !isFuture && (
        <div className="flex items-center gap-3 mb-5">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            hasRecord ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {hasRecord ? '✓ Attendance recorded' : '⚠ No record for this date'}
          </span>
          {hasRecord && (
            <button
              onClick={deleteRecord}
              disabled={deleting}
              className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete record'}
            </button>
          )}
        </div>
      )}

      {isFuture ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-400 text-sm">Cannot manage attendance for future dates.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No students in this class.</p>
        </div>
      ) : (
        <>
          {/* Summary + actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-3 flex-1">
              {(['present', 'absent', 'late'] as AttendanceStatus[]).map((s) => (
                <div key={s} className={`flex-1 text-center py-2 rounded-xl border text-sm font-semibold ${STATUS_STYLES[s]}`}>
                  {counts[s]} {STATUS_LABEL[s]}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="search"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 w-36"
              />
              <button
                onClick={resetAll}
                className="px-3 py-2 text-sm font-medium bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors whitespace-nowrap"
              >
                Reset All
              </button>
            </div>
          </div>

          {/* Success banner */}
          {saved && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-green-600">✓</span>
              <p className="text-sm font-semibold text-green-800">Attendance saved successfully</p>
            </div>
          )}

          {/* Student list */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5">
            {filtered.map((s) => {
              const initials = s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
              const status = statuses[s.id] ?? 'present';
              return (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <span className="text-purple-700 font-bold text-xs">{initials}</span>
                  </div>
                  <span className="flex-1 text-slate-800 font-medium text-sm">{s.name}</span>
                  <button
                    onClick={() => toggle(s.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${STATUS_STYLES[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Save button */}
          <button
            onClick={saveAttendance}
            disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold py-3 rounded-2xl transition-colors text-sm"
          >
            {saving ? 'Saving...' : hasRecord ? 'Update Attendance' : 'Save Attendance'}
          </button>
        </>
      )}
    </div>
  );
}
