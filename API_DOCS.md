# API & Realtime Data Architecture

**MsikaFlo** operates on a fully serverless architecture powered by **Firebase Authentication**, **Google Cloud Firestore**, **Firebase Storage**, **Firebase Cloud Messaging (FCM)**, and **Zustand** state management stores.

> **Developer:** Indelible Technologies — [indelibletechnologiesmw@gmail.com](mailto:indelibletechnologiesmw@gmail.com)  
> **Last updated:** 13 October 2026

---

## 1. Authentication Service (`authStore.ts`)

### Sign In
```ts
signInWithEmailAndPassword(auth, email, password)
```

### Password Persistence
| Mode | Firebase Persistence | Behaviour |
|---|---|---|
| Remember Me **ON** | `browserLocalPersistence` | Session survives browser close; email pre-filled on next visit |
| Remember Me **OFF** | `browserSessionPersistence` | Session ends on browser close; form fields reset on logout |

### Self-Service Password Reset
```ts
sendPasswordResetEmail(auth, email)
```
Triggered from the **Forgot Password** screen. Firebase sends an official password-reset email to the user's registered address. No Admin action required.

### Offline Credential Caching
On successful login the `authStore` stores a SHA-256 hash of the user's password in `localStorage`. When `navigator.onLine === false`, the login form verifies the entered password against this hash to authenticate offline without a Firebase round-trip. The hash is never transmitted over the network.

### Sign Out & Listener Cleanup
```ts
signOut(auth)  // → triggers unsubscribeAllListeners()
```
Cleanly terminates all background Firestore `onSnapshot` subscriptions before the session ends.

### Real-Time Profile Listener
```ts
onSnapshot(doc(db, 'users', uid))
```
Keeps the logged-in user's role, branch, and profile picture updated in real time across all open sessions.

---

## 2. Product & Inventory (`cartStore.ts`)

```ts
// Listen to full product catalogue
onSnapshot(collection(db, 'products'))

// Decrement stock on sale
updateDoc(doc(db, 'products', id), { stock: increment(-qty) })

// Listen to user's held carts
onSnapshot(collection(db, 'users', userId, 'heldCarts'))

// Save a held cart
setDoc(doc(db, 'users', userId, 'heldCarts', cartId), cartData)

// Delete a held cart on resume
deleteDoc(doc(db, 'users', userId, 'heldCarts', cartId))
```

### AI Product Finder (TensorFlow.js + MobileNet)
The AI Product Scanner uses `@tensorflow/tfjs` with the MobileNet model to identify products from camera images. The top-3 predicted labels are matched against the product catalogue in `cartStore`. No external API call is made — inference runs entirely on-device.

### Barcode Scanner
The barcode scanner reads a product's `barcode` field in the `products` collection. On a successful scan, the matching product is added directly to the active POS cart.

---

## 3. Sales & Transactions (`dataStore.ts`)

```ts
// Listen to all sales (most recent first)
onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')))

// Listen to outstanding credit sales
onSnapshot(query(collection(db, 'sales'), where('isCredit', '==', true)))

// Process a new sale (atomic batch)
const batch = writeBatch(db)
batch.set(doc(collection(db, 'sales')), saleData)        // write sale record
// for each item: decrement product stock
batch.update(doc(db, 'products', item.productId), { stock: increment(-item.qty) })
await batch.commit()

// Record a credit repayment
updateDoc(doc(db, 'sales', saleId), { creditPaid: increment(amount) })
```

---

## 4. Expenses (`dataStore.ts`)

```ts
onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')))
addDoc(collection(db, 'expenses'), expenseData)
```

---

## 5. Branches (`dataStore.ts`)

```ts
// Listen to all branches
onSnapshot(collection(db, 'branches'))

// Add a new branch
addDoc(collection(db, 'branches'), branchData)

// Update branch details
updateDoc(doc(db, 'branches', branchId), updates)

// Deactivate a branch
updateDoc(doc(db, 'branches', branchId), { isActive: false })
```

---

## 6. Online Orders (`dataStore.ts`)

Orders submitted via the public Online Storefront (`/store` route, accessible without login).

```ts
// Submit an order (public — no auth required, Firestore rules allow write)
addDoc(collection(db, 'onlineOrders'), orderData)

// Listen to all incoming orders (Admin/Manager)
onSnapshot(query(collection(db, 'onlineOrders'), orderBy('createdAt', 'desc')))

// Update order status
updateDoc(doc(db, 'onlineOrders', orderId), { status: 'processing' | 'completed' | 'cancelled' })
```

---

## 7. Password Reset Requests (`dataStore.ts`)

For users who cannot use self-service password reset (e.g. no email access).

```ts
// Submit a request (user)
addDoc(collection(db, 'passwordRequests'), {
  userId, userName, userEmail, reason,
  status: 'pending',
  requestedAt: Date.now()
})

// Listen to all pending requests (Admin only)
onSnapshot(query(
  collection(db, 'passwordRequests'),
  where('status', '==', 'pending')
))

// Resolve a request (Admin)
updateDoc(doc(db, 'passwordRequests', requestId), {
  status: 'approved' | 'rejected',
  resolvedAt: Date.now(),
  resolvedBy: adminName
})
```

---

## 8. Stationery Services (`stationeryStore.ts`)

```ts
onSnapshot(collection(db, 'stationeryServices'))
addDoc(collection(db, 'stationeryServices'), serviceData)
updateDoc(doc(db, 'stationeryServices', id), updates)
deleteDoc(doc(db, 'stationeryServices', id))
```

---

## 9. Employees (`dataStore.ts`)

```ts
// Listen to all employees
onSnapshot(collection(db, 'employees'))

// Listen to an employee's payslip history
onSnapshot(collection(db, 'employees', employeeId, 'payslips'))

// Issue a payslip
addDoc(collection(db, 'employees', employeeId, 'payslips'), payslipData)
```

---

## 10. Settings & Audit Logs

```ts
// Global settings (single document)
onSnapshot(doc(db, 'settings', 'global'))
updateDoc(doc(db, 'settings', 'global'), updates)

// Audit logs (most recent 100 entries)
onSnapshot(query(
  collection(db, 'auditLogs'),
  orderBy('timestamp', 'desc'),
  limit(100)
))

// Write an audit entry
addDoc(collection(db, 'auditLogs'), {
  action, details, user, userId,
  timestamp: Date.now()
})
```

---

## 11. Firebase Storage

```ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

// Upload employee photo
const storageRef = ref(storage, `employees/${employeeId}/photo.jpg`)
await uploadBytes(storageRef, file)
const photoUrl = await getDownloadURL(storageRef)

// Upload product image
const productRef = ref(storage, `products/${productId}/image.jpg`)
await uploadBytes(productRef, file)
```

---

## 12. Firebase Cloud Messaging (FCM)

FCM push notifications are delivered to Admin/Manager devices for:

| Event | Topic / Token |
|---|---|
| New online order received | Admin FCM token |
| Product stock below reorder level | Manager FCM token |
| Password reset request submitted | Admin FCM token |

FCM tokens are registered on login via the `messaging` Firebase SDK and stored in the user's `users/{uid}` document.

---

## 13. Error Handling

All Firestore write operations are wrapped in `try/catch`. On failure:

1. The transaction is saved to the **local pending queue** in `localStorage`.
2. A toast alert notifies the user that the operation is queued offline.
3. The Dashboard **Pending Syncs** counter increments.
4. On next `window.online` event, all queued operations are retried automatically.
