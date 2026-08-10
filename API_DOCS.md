# API & Realtime Data Architecture

The **Jef Investment ERP** operates via a serverless architecture using **Firebase Auth**, **Google Cloud Firestore**, and **Zustand State Stores**.

---

## 1. Authentication Service (`authStore.ts`)

- **Sign In:**
  `signInWithEmailAndPassword(auth, email, password)`
- **Sign Out & Listener Cleanup:**
  `signOut(auth)` — Triggers `unsubscribeAllListeners()` to cleanly terminate all background real-time subscriptions.
- **Persistence:**
  - `browserLocalPersistence`: Enabled when **Remember Me** is checked. Saves user email to local browser storage.
  - `browserSessionPersistence`: Used when **Remember Me** is unchecked. Form fields are reset to empty on logout.
- **Profile Listener:**
  `onSnapshot(doc(db, 'users', uid))` — Keeps user role, branch, and profile picture updated in real time.

---

## 2. Realtime Data Collections

Data is synchronized in real time across all logged-in devices using Firestore `onSnapshot` subscriptions:

### Product & Inventory (`cartStore.ts`)
- **Listen Products:** `onSnapshot(collection(db, 'products'))`
- **Stock Decrement (Cashier):** `updateDoc(doc(db, 'products', id), { stock: increment(-qty) })`
- **Listen Held Carts:** `onSnapshot(collection(db, 'users', userId, 'heldCarts'))`

### Sales & Transactions (`dataStore.ts`)
- **Listen Sales:** `onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')))`
- **Add Sale:** `addDoc(collection(db, 'sales'), saleData)` + `writeBatch` for inventory updates.
- **Listen Credits:** `onSnapshot(query(collection(db, 'sales'), where('isCredit', '==', true)))`
- **Record Repayment:** `updateDoc(doc(db, 'sales', id), { creditPaid: increment(amount) })`

### Expenses (`dataStore.ts`)
- **Listen Expenses:** `onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')))`
- **Add Expense:** `addDoc(collection(db, 'expenses'), expenseData)`

### Stationery Services (`stationeryStore.ts`)
- **Listen Services:** `onSnapshot(collection(db, 'stationeryServices'))`

### Employees (`dataStore.ts`)
- **Listen Employees:** `onSnapshot(collection(db, 'employees'))`

### Settings & Audit Logs
- **Listen Settings:** `onSnapshot(doc(db, 'settings', 'global'))`
- **Listen Audit Logs:** `onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100)))`
