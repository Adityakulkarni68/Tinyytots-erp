import { useEffect, useState, useMemo, useRef, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { format, subDays, addDays, isToday, parseISO } from 'date-fns';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { Student, AttendanceStatus } from '../../types';

type Statuses = Record<string, AttendanceStatus>;

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'late'];

function nextStatus(current: AttendanceStatus): AttendanceStatus {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
}

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-present-bg border-present-border text-present',
  absent:  'bg-absent-bg  border-absent-border  text-absent',
  late:    'bg-late-bg    border-late-border    text-late',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
};

function StudentRow({
  student,
  status,
  onToggle,
  readOnly,
}: {
  student: Student;
  status: AttendanceStatus;
  onToggle: () => void;
  readOnly: boolean;
}) {
  const initials = student.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
        <span className="text-primary-700 font-bold text-sm">{initials}</span>
      </div>
      <span className="flex-1 text-slate-800 font-medium">{student.name}</span>
      {readOnly ? (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      ) : (
        <button
          onClick={onToggle}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABEL[status]}
        </button>
      )}
    </div>
  );
}

function parseCsv(text: string): string[] {
  return text
    .split('\n')
    .map((row) => row.split(',')[0].replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}

function parseNames(text: string): string[] {
  return text.split('\n').map((n) => n.trim()).filter(Boolean);
}

function ImportModal({
  classId,
  onImported,
  onClose,
}: {
  classId: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'paste' | 'csv'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [csvNames, setCsvNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = tab === 'paste' ? parseNames(pasteText) : csvNames;

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvNames(parseCsv(ev.target?.result as string));
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview.length) return;
    setSaving(true);
    const ids: string[] = [];
    for (const name of preview) {
      const ref = await addDoc(collection(db, 'students'), { name, classId });
      ids.push(ref.id);
    }
    await updateDoc(doc(db, 'classes', classId), { studentIds: arrayUnion(...ids) });
    onImported();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Import Students</h3>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4">
          {(['paste', 'csv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t === 'paste' ? 'Paste Names' : 'Upload CSV'}
            </button>
          ))}
        </div>

        {tab === 'paste' ? (
          <textarea
            autoFocus
            rows={6}
            placeholder={'One name per line:\nEmma Wilson\nLiam Johnson\nOlivia Brown'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono"
          />
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
          >
            <p className="text-sm text-slate-500">Click to choose a CSV file</p>
            <p className="text-xs text-slate-400 mt-1">First column is used as the student name</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2 max-h-32 overflow-y-auto">
            <p className="text-xs text-slate-500 mb-1">{preview.length} student{preview.length > 1 ? 's' : ''} to add:</p>
            {preview.map((name, i) => (
              <p key={i} className="text-sm text-slate-700">{name}</p>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={saving || preview.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Adding...' : `Add ${preview.length || ''} Students`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [className, setClassName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Statuses>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isViewingToday = isToday(parseISO(selectedDate));

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setSearch('');
    setSubmittedAt(null);

    // Cancellation flag: if the date changes before this fetch completes,
    // discard the result so a stale response never overwrites current state.
    let cancelled = false;

    async function load() {
      const [classSnap, studentsSnap, attendanceSnap] = await Promise.all([
        getDoc(doc(db, 'classes', classId!)),
        getDocs(query(collection(db, 'students'), where('classId', '==', classId))),
        getDoc(doc(db, 'attendance', `${classId}_${selectedDate}`)),
      ]);

      if (cancelled) return;

      if (classSnap.exists()) setClassName(classSnap.data().name);

      const loaded: Student[] = studentsSnap.docs
        .map((d) => ({ id: d.id, name: d.data().name, classId: d.data().classId, photoURL: d.data().photoURL }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(loaded);

      if (attendanceSnap.exists()) {
        const data = attendanceSnap.data();
        setStatuses(data.entries as Statuses);
        // Past dates are always read-only. Today stays editable even if already submitted.
        setReadOnly(!isViewingToday);
        if (data.submittedAt?.toDate) {
          setSubmittedAt(format(data.submittedAt.toDate(), 'h:mm a'));
        }
      } else {
        // For today: default all to Present (exception-based marking per PRD).
        // For past dates with no record: show empty — do NOT default to present,
        // as that would make every unrecorded day look like a submission.
        const defaults: Statuses = {};
        if (isViewingToday) {
          for (const s of loaded) defaults[s.id] = 'present';
        }
        setStatuses(defaults);
        setReadOnly(!isViewingToday);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [classId, selectedDate, isViewingToday]);

  const filtered = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search],
  );

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0 };
    for (const s of students) {
      c[statuses[s.id] ?? 'present']++;
    }
    return c;
  }, [statuses, students]);

  function toggle(studentId: string) {
    setStatuses((prev) => ({ ...prev, [studentId]: nextStatus(prev[studentId] ?? 'present') }));
  }

  function markAllPresent() {
    const all: Statuses = {};
    for (const s of students) all[s.id] = 'present';
    setStatuses(all);
  }

  async function submit() {
    if (!classId || !user) return;
    setSubmitting(true);
    try {
      const finalCounts = { present: 0, absent: 0, late: 0 };
      for (const id of students.map((s) => s.id)) {
        finalCounts[statuses[id] ?? 'present']++;
      }
      await setDoc(doc(db, 'attendance', `${classId}_${selectedDate}`), {
        date: selectedDate,
        classId,
        teacherId: user.uid,
        submittedAt: serverTimestamp(),
        entries: statuses,
        counts: finalCounts,
      });
      setSubmittedAt(format(new Date(), 'h:mm a'));
      setShowConfirm(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  const displayDate = format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy');

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/teacher')}
          className="text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{className || 'Class'}</h1>
          <p className="text-slate-500 text-sm">{displayDate}</p>
        </div>
        {readOnly && submittedAt && (
          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            Submitted {submittedAt}
          </span>
        )}
      </div>

      {/* Submit success banner */}
      {showSuccess && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Attendance submitted</p>
            <p className="text-xs text-green-600">Saved at {submittedAt}</p>
          </div>
        </div>
      )}

      {/* Date navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">        <button
          onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-slate-700">
          {isViewingToday ? 'Today' : format(parseISO(selectedDate), 'MMM d, yyyy')}
        </span>
        <button
          onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
          disabled={isViewingToday}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-12">Loading...</p>
      ) : (
        <>
          {/* Summary pills */}
          <div className="flex gap-3 mb-4">
            {(['present', 'absent', 'late'] as AttendanceStatus[]).map((s) => (
              <div key={s} className={`flex-1 text-center py-2 rounded-xl border text-sm font-semibold ${STATUS_STYLES[s]}`}>
                {counts[s]} {STATUS_LABEL[s]}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 mb-4">
            <input
              type="search"
              placeholder="Search student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {isViewingToday && (
              <div className="flex gap-2">
                <button
                  onClick={markAllPresent}
                  className="flex-1 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  All Present
                </button>
                {submittedAt && (
                  <button
                    onClick={() => { if (confirm('Reset all students to Present?')) markAllPresent(); }}
                    className="flex-1 py-2 text-sm font-medium bg-white border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setShowImport(true)}
                  className="flex-1 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  + Import
                </button>
              </div>
            )}
          </div>

          {/* Roster */}
          <div className="bg-white rounded-xl border border-slate-200 px-4">
            {filtered.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No students found.</p>
            ) : (
              filtered.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  status={statuses[s.id] ?? 'present'}
                  onToggle={() => toggle(s.id)}
                  readOnly={readOnly}
                />
              ))
            )}
          </div>

          {/* Submit / Update button — today only, always shown */}
          {isViewingToday && (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full mt-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {submittedAt ? 'Update Attendance' : 'Submit Attendance'}
            </button>
          )}

          {!isViewingToday && !submittedAt && (
            <p className="text-center text-slate-400 text-sm mt-6">No attendance recorded for this date.</p>
          )}
        </>
      )}

      {/* Import students modal */}
      {showImport && classId && (
        <ImportModal
          classId={classId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            // Re-trigger the load effect by nudging selectedDate (same value, new object triggers nothing)
            // Instead force a re-fetch by resetting students
            setStudents([]);
            setLoading(true);
            getDocs(query(collection(db, 'students'), where('classId', '==', classId))).then((snap) => {
              const loaded: Student[] = snap.docs
                .map((d) => ({ id: d.id, name: d.data().name, classId: d.data().classId, photoURL: d.data().photoURL }))
                .sort((a, b) => a.name.localeCompare(b.name));
              setStudents(loaded);
              const defaults: Statuses = { ...statuses };
              for (const s of loaded) if (!defaults[s.id]) defaults[s.id] = 'present';
              setStatuses(defaults);
              setLoading(false);
            });
          }}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">{submittedAt ? 'Update Attendance?' : 'Submit Attendance?'}</h3>
            <p className="text-slate-500 text-sm mb-5">
              {format(parseISO(selectedDate), 'MMMM d, yyyy')} — {className}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {(['present', 'absent', 'late'] as AttendanceStatus[]).map((s) => (
                <div key={s} className={`text-center py-3 rounded-xl border ${STATUS_STYLES[s]}`}>
                  <p className="text-2xl font-bold">{counts[s]}</p>
                  <p className="text-xs font-semibold mt-0.5">{STATUS_LABEL[s]}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
