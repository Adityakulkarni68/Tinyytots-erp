import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths, isToday, parseISO } from 'date-fns';
import { db } from '../../firebase/config';
import type { AttendanceRecord } from '../../types';

const STATUS_DOT: Record<string, string> = {
  submitted: 'bg-green-500',
  none: 'bg-slate-200',
  today: 'bg-primary-400',
};

export default function TeacherReportPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [className, setClassName] = useState('');
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    async function load() {
      setLoading(true);
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const [classSnap, attendanceSnaps] = await Promise.all([
        getDoc(doc(db, 'classes', classId!)),
        // Single-field query avoids composite index requirement.
        // Filter by date range client-side.
        getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
      ]);

      if (classSnap.exists()) setClassName(classSnap.data().name);

      const map: Record<string, AttendanceRecord> = {};
      for (const d of attendanceSnaps.docs) {
        const data = d.data();
        if (data.date >= start && data.date <= end) {
          map[data.date] = { id: d.id, ...data } as AttendanceRecord;
        }
      }
      setRecords(map);
      setSelected(null);
      setLoading(false);
    }
    load();
  }, [classId, currentMonth]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth)); // 0=Sun

  const monthLabel = format(currentMonth, 'MMMM yyyy');

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/teacher')} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{className} — Report</h1>
          <p className="text-slate-500 text-sm">Monthly attendance calendar</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
        >‹</button>
        <span className="font-semibold text-slate-800">{monthLabel}</span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={format(addMonths(currentMonth, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >›</button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Loading...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Padding cells */}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const record = records[dateStr];
              const today = isToday(day);
              const future = dateStr > format(new Date(), 'yyyy-MM-dd');

              return (
                <button
                  key={dateStr}
                  disabled={future || (!record && !today)}
                  onClick={() => record && setSelected(selected?.date === dateStr ? null : record)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors
                    ${future ? 'text-slate-300 cursor-default' : ''}
                    ${!future && !record ? 'text-slate-400 cursor-default' : ''}
                    ${record ? 'hover:bg-primary-50 cursor-pointer' : ''}
                    ${selected?.date === dateStr ? 'ring-2 ring-primary-500 bg-primary-50' : ''}
                    ${today ? 'font-bold text-primary-600' : 'text-slate-700'}
                  `}
                >
                  <span>{format(day, 'd')}</span>
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    record ? STATUS_DOT.submitted : today ? STATUS_DOT.today : STATUS_DOT.none
                  }`} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 mb-4 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Submitted</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />No record</span>
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-slate-800">{format(parseISO(selected.date), 'EEEE, MMMM d, yyyy')}</p>
              {selected.submittedAt?.toDate && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Submitted at {format(selected.submittedAt.toDate(), 'h:mm a')}
                </p>
              )}
            </div>
            <div className="flex gap-3 text-center">
              {(['present', 'absent', 'late'] as const).map((s) => (
                <div key={s}>
                  <p className="text-xl font-bold text-slate-800">{selected.counts[s]}</p>
                  <p className="text-xs text-slate-500 capitalize">{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-student breakdown */}
          <StudentBreakdown entries={selected.entries} classId={classId!} />
        </div>
      )}
    </div>
  );
}

function StudentBreakdown({ entries, classId }: { entries: Record<string, string>; classId: string }) {
  const [students, setStudents] = useState<Record<string, string>>({});

  useEffect(() => {
    getDocs(query(collection(db, 'students'), where('classId', '==', classId))).then((snap) => {
      const map: Record<string, string> = {};
      for (const d of snap.docs) map[d.id] = d.data().name;
      setStudents(map);
    });
  }, [classId]);

  const STATUS_STYLES: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
  };

  const sorted = Object.entries(entries).sort(([, a], [, b]) => a.localeCompare(b));

  return (
    <div className="divide-y divide-slate-100">
      {sorted.map(([studentId, status]) => (
        <div key={studentId} className="flex items-center justify-between py-2">
          <span className="text-sm text-slate-700">{students[studentId] ?? '...'}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[status]}`}>
            {status}
          </span>
        </div>
      ))}
    </div>
  );
}
