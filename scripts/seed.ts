import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, addDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, { persistence: inMemoryPersistence });
const db = getFirestore(app);

async function createUser(
  email: string,
  password: string,
  displayName: string,
  role: 'teacher' | 'admin',
  assignedClassIds: string[],
): Promise<string> {
  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch (err: any) {
    if (err.code !== 'auth/email-already-in-use') throw err;
    // Auth account exists from a previous partial run — sign in to get the UID
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log(`  [user]    ${role.padEnd(7)} ${displayName} <${email}> (auth existed, re-used)`);
  }
  await setDoc(doc(db, 'users', uid), { email, displayName, role, assignedClassIds });
  console.log(`  [user]    ${role.padEnd(7)} ${displayName} <${email}>`);
  return uid;
}

async function seed() {
  console.log('\nSeeding Firebase...\n');

  // Step 1: create admin first so we are authenticated for all subsequent writes
  const adminUid = await createUser('admin@tinytots.com', 'Admin@123', 'Admin User', 'admin', []);
  // sign back in as admin (createUserWithEmailAndPassword auto-signs in, but subsequent
  // createUser calls switch the session — sign in again after teachers are created)
  console.log();

  // Step 2: classes and students while signed in as admin
  const nurseryRef = await addDoc(collection(db, 'classes'), { name: 'Nursery', teacherIds: [], studentIds: [] });
  const k1Ref = await addDoc(collection(db, 'classes'), { name: 'K1', teacherIds: [], studentIds: [] });
  console.log(`  [class]   Nursery  (${nurseryRef.id})`);
  console.log(`  [class]   K1       (${k1Ref.id})\n`);

  const nurseryStudentIds: string[] = [];
  for (const name of ['Emma Wilson', 'Liam Johnson', 'Olivia Brown']) {
    const ref = await addDoc(collection(db, 'students'), { name, classId: nurseryRef.id });
    nurseryStudentIds.push(ref.id);
    console.log(`  [student] Nursery  ${name}`);
  }

  const k1StudentIds: string[] = [];
  for (const name of ['Noah Davis', 'Ava Martinez', 'Lucas Anderson']) {
    const ref = await addDoc(collection(db, 'students'), { name, classId: k1Ref.id });
    k1StudentIds.push(ref.id);
    console.log(`  [student] K1       ${name}`);
  }
  console.log();

  // Step 3: create teachers (each createUser call switches the auth session)
  const teacher1Uid = await createUser(
    'sarah.johnson@tinytots.com', 'Teacher@123',
    'Sarah Johnson', 'teacher', [nurseryRef.id],
  );
  const teacher2Uid = await createUser(
    'mike.chen@tinytots.com', 'Teacher@123',
    'Mike Chen', 'teacher', [k1Ref.id],
  );
  console.log();

  // Step 4: sign back in as admin to back-fill class references
  await signInWithEmailAndPassword(auth, 'admin@tinytots.com', 'Admin@123');
  await updateDoc(doc(db, 'classes', nurseryRef.id), {
    teacherIds: [teacher1Uid],
    studentIds: nurseryStudentIds,
  });
  await updateDoc(doc(db, 'classes', k1Ref.id), {
    teacherIds: [teacher2Uid],
    studentIds: k1StudentIds,
  });
  console.log('  [class]   Updated teacher/student references\n');

  console.log('Seed complete!\n');
  console.log('Credentials:');
  console.log('  admin@tinytots.com             Admin@123');
  console.log('  sarah.johnson@tinytots.com     Teacher@123   (Nursery)');
  console.log('  mike.chen@tinytots.com         Teacher@123   (K1)\n');

  void adminUid; // used implicitly via auth session
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err.code ?? err.message);
    process.exit(1);
  });
