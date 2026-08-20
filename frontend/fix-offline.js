import fs from 'fs';
import path from 'path';

const filesToFix = [
  'src/store/auditStore.ts',
  'src/store/cartStore.ts',
  'src/store/dataStore.ts',
  'src/store/settingsStore.ts',
  'src/store/stationeryStore.ts'
];

filesToFix.forEach(file => {
  const fullPath = path.resolve(file);
  let content = fs.readFileSync(fullPath, 'utf8');

  // Regex to match `await addDoc(...)`, `await setDoc(...)`, `await updateDoc(...)`, `await deleteDoc(...)`
  // and replace with non-awaited version with .catch()
  
  // Example: await addDoc(collection(db, 'expenses'), newExpense);
  // -> addDoc(collection(db, 'expenses'), newExpense).catch(e => console.error('Offline write deferred', e));

  // Note: we only target those that end with a semicolon or inside an async function.
  // A simple regex might be tricky if they span multiple lines.

  content = content.replace(/await\s+(addDoc|setDoc|updateDoc|deleteDoc)\((.*?)\);/gs, (match, fn, args) => {
    return `${fn}(${args}).catch(e => console.warn('Offline write deferred or failed:', e));`;
  });

  fs.writeFileSync(fullPath, content);
  console.log(`Fixed ${file}`);
});
