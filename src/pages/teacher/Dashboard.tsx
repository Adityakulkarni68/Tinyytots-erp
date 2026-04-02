import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import type { Class } from '../../types';

interface ClassCard extends Class {
  studentCount: number;
  submittedToday: boolean;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const displayDate = format(new Date(), 'EEEE, MMMM d, yyyy');
  const firstName = user?.displayName?.split(' ')[0] ?? 'Teacher';

  useEffect(() => {
    async function load() {
      if (!user?.assignedClassIds?.length) { setLoading(false); return; }

      const cards: ClassCard[] = [];
      for (const classId of user.assignedClassIds) {
        const [classSnap, attendanceSnap] = await Promise.all([
          getDoc(doc(db, 'classes', classId)),
          getDoc(doc(db, 'attendance', `${classId}_${today}`)),
        ]);
        if (!classSnap.exists()) continue;
        const data = classSnap.data();
        cards.push({
          id: classId,
          name: data.name,
          teacherIds: data.teacherIds,
          studentIds: data.studentIds,
          studentCount: (data.studentIds as string[]).length,
          submittedToday: attendanceSnap.exists(),
        });
      }
      setClasses(cards);
      setLoading(false);
    }
    load();
  }, [user, today]);

  const pending = classes.filter((c) => !c.submittedToday).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Good morning, {firstName}</h1>
        <p className="text-slate-500 text-sm mt-1">{displayDate}</p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading classes...</p>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">No classes assigned yet. Contact your administrator.</p>
        </div>
      ) : (
        <>
          {pending > 0 && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              {pending} class{pending > 1 ? 'es' : ''} still need{pending === 1 ? 's' : ''} attendance today.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {classes.map((cls) => (
              <div key={cls.id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{cls.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{cls.studentCount} students</p>
                  </div>
                  {cls.submittedToday ? (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      Submitted
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                      Pending
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/teacher/class/${cls.id}`)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {cls.submittedToday ? 'View Attendance' : 'Mark Attendance'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
