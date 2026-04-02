import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'teacher' | 'admin';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedClassIds: string[];
}

export interface Class {
  id: string;
  name: string;
  teacherIds: string[];
  studentIds: string[];
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  photoURL?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  classId: string;
  teacherId: string;
  submittedAt: Timestamp;
  entries: Record<string, AttendanceStatus>;
  counts: {
    present: number;
    absent: number;
    late: number;
  };
}
