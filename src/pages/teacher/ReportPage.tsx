import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths, isToday, parseISO } from 'date-fns';
import { db } from '../../firebase/config';
import type { AttendanceRecord } from '../../types';

// ── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ present, absent, late }: { present: number; absent: number; late: number }) {
  const total = present + absent + late;
  if (total === 0) return null;

  const size = 120;
  const r = 44;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const segments = [
    { value: present, color: '#22c55e', label: 'Present' },
    { value: absent,  color: '#ef4444', label: 'Absent' },
    { value: late,    color: '#f59e0b', label: 'Late' },
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circumference;
    const gap = circumference - dash;
    const arc = { ...seg, dash, gap, offset };
    offset += dash;
    return arc;
  });

  const pct = Math.round((present / total) * 100);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={14} />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={14}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-800">{pct}%</span>
          <span className="text-[10px] text-slate-400">Present</span>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-xs text-slate-600">{seg.label}</span>
            <span className="text-xs font-bold text-slate-800 ml-auto pl-4">{seg.value}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400">Total</span>
          <span className="text-xs font-bold text-slate-800 ml-auto pl-4">{total}</span>
        </div>
      </div>
    </div>
  );
}

// ── Bar chart (monthly trend) ─────────────────────────────────────────────────
function MonthlyBarChart({ records }: { records: Record<string, AttendanceRecord> }) {
  const entries = Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return (
    <p className="text-slate-400 text-xs text-center py-4">No data for this month yet.</p>
  );

  const maxTotal = Math.max(...entries.map((r) => r.counts.present + r.counts.absent + r.counts.late), 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[280px]">
        {/* Bars */}
        <div className="flex items-end gap-0.5 h-28 px-1">
          {entries.map((r) => {
            const total = r.counts.present + r.counts.absent + r.counts.late;
            const pH = (r.counts.present / maxTotal) * 100;
            const aH = (r.counts.absent / maxTotal) * 100;
            const lH = (r.counts.late / maxTotal) * 100;
            return (
              <div
                key={r.date}
                className="flex-1 flex flex-col justify-end gap-px group relative"
                title={`${format(parseISO(r.date), 'MMM d')}: ${r.counts.present}P ${r.counts.absent}A ${r.counts.late}L`}
              >
                {r.counts.late > 0 && (
                  <div className="w-full rounded-t-sm bg-amber-400 transition-all" style={{ height: `${lH}%` }} />
                )}
                {r.counts.absent > 0 && (
                  <div className="w-full bg-red-400 transition-all" style={{ height: `${aH}%` }} />
                )}
                <div className="w-full rounded-b-sm bg-green-400 transition-all" style={{ height: `${pH}%` }} />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  {format(parseISO(r.date), 'MMM d')}: {total} students
                </div>
              </div>
            );
          })}
        </div>
        {/* X-axis labels — show every ~5th */}
        <div className="flex gap-0.5 px-1 mt-1">
          {entries.map((r, i) => (
            <div key={r.date} className="flex-1 text-center">
              {i % Math.max(1, Math.floor(entries.length / 6)) === 0 && (
                <span className="text-[9px] text-slate-400">{format(parseISO(r.date), 'd')}</span>
              )}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex gap-3 justify-center mt-2">
          {[['bg-green-400', 'Present'], ['bg-red-400', 'Absent'], ['bg-amber-400', 'Late']].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className={`w-2 h-2 rounded-sm ${color}`} />{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
        getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
      ]);

      if (classSnap.exists()) setClassName(classSnap.data().name);

      const map: Record<string, AttendanceRecord> = {};
      for (const d of attendanceSnaps.docs) {
        const data = d.data();
        if (data.date >= start && data.date <= end)
          map[data.date] = { id: d.id, ...data } as AttendanceRecord;
      }
      setRecords(map);
      setSelected(null);
      setLoading(false);
    }
    load();
  }, [classId, currentMonth]);

  // Monthly totals for summary cards
  const monthTotals = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0, days: 0 };
    for (const r of Object.values(records)) {
      t.present += r.counts.present;
      t.absent  += r.counts.absent;
      t.late    += r.counts.late;
      t.days++;
    }
    return t;
  }, [records]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/teacher')} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{className} — Report</h1>
          <p className="text-slate-500 text-sm">Monthly attendance overview</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">‹</button>
        <span className="font-semibold text-slate-800">{format(currentMonth, 'MMMM yyyy')}</span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={format(addMonths(currentMonth, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-30"
        >›</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      ) : (
        <>
          {/* Monthly summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Days', value: monthTotals.days, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Present', value: monthTotals.present, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Absent', value: monthTotals.absent, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Late', value: monthTotals.late, color: 'text-amber-500', bg: 'bg-amber-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Donut — monthly totals */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Breakdown</p>
              {monthTotals.days === 0 ? (
                <p className="text-slate-400 text-xs text-center py-6">No data yet</p>
              ) : (
                <DonutChart present={monthTotals.present} absent={monthTotals.absent} late={monthTotals.late} />
              )}
            </div>

            {/* Bar chart — daily trend */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-4">Daily Trend</p>
              <MonthlyBarChart records={records} />
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Calendar</p>
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const record = records[dateStr];
                const today = isToday(day);
                const future = dateStr > format(new Date(), 'yyyy-MM-dd');
                const pct = record ? Math.round((record.counts.present / (record.counts.present + record.counts.absent + record.counts.late)) * 100) : null;

                return (
                  <button
                    key={dateStr}
                    disabled={future || !record}
                    onClick={() => record && setSelected(selected?.date === dateStr ? null : record)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-all
                      ${future || !record ? 'text-slate-300 cursor-default' : 'hover:bg-purple-50 cursor-pointer text-slate-700'}
                      ${today ? 'font-bold text-purple-600' : ''}
                      ${selected?.date === dateStr ? 'ring-2 ring-purple-500 bg-purple-50' : ''}
                    `}
                  >
                    <span>{format(day, 'd')}</span>
                    {record && pct !== null ? (
                      <span className={`text-[8px] font-bold mt-0.5 ${pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {pct}%
                      </span>
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${record ? 'bg-green-500' : 'bg-slate-200'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-slate-500 mb-4 px-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥80% present</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />50–79%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;50%</span>
          </div>

          {/* Selected day detail */}
          {selected && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="font-semibold text-slate-800">{format(parseISO(selected.date), 'EEEE, MMMM d, yyyy')}</p>
                  {selected.submittedAt?.toDate && (
                    <p className="text-xs text-slate-400 mt-0.5">Submitted at {format(selected.submittedAt.toDate(), 'h:mm a')}</p>
                  )}
                </div>
              </div>

              {/* Donut for selected day */}
              <div className="mb-5">
                <DonutChart present={selected.counts.present} absent={selected.counts.absent} late={selected.counts.late} />
              </div>

              <StudentBreakdown entries={selected.entries} classId={classId!} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Student breakdown ─────────────────────────────────────────────────────────
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
    absent:  'bg-red-100 text-red-700',
    late:    'bg-amber-100 text-amber-700',
  };

  const sorted = Object.entries(entries).sort(([, a], [, b]) => a.localeCompare(b));

  return (
    <div className="divide-y divide-slate-100">
      {sorted.map(([studentId, status]) => (
        <div key={studentId} className="flex items-center justify-between py-2.5">
          <span className="text-sm text-slate-700">{students[studentId] ?? '...'}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[status]}`}>
            {status}
          </span>
        </div>
      ))}
    </div>
  );
}
