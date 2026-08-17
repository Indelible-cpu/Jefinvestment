import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Callable function: deleteAuthUser
 * Called by an authenticated admin to permanently delete a user's
 * Firebase Auth account so the same email can be reused.
 */
export const deleteAuthUser = functions.https.onCall(async (data, context) => {
  // 1. Only allow authenticated admins to call this function
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to perform this action."
    );
  }

  // 2. Check the caller's role in Firestore
  const callerDoc = await admin
    .firestore()
    .collection("users")
    .doc(context.auth.uid)
    .get();

  const callerRole = callerDoc.exists ? callerDoc.data()?.role : null;
  const callerEmail = context.auth.token.email || "";
  const isAdmin =
    callerRole === "ADMIN" ||
    callerEmail === "admin@jefinvestment.com" ||
    callerEmail === "jefinvestmentmw@gmail.com";

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete users."
    );
  }

  // 3. Validate the target userId
  const { userId } = data;
  if (!userId || typeof userId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A valid userId must be provided."
    );
  }

  // 4. Prevent admin from deleting themselves
  if (userId === context.auth.uid) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "You cannot delete your own account."
    );
  }

  // 5. Delete the Firebase Auth account (allows email reuse)
  await admin.auth().deleteUser(userId);

  // 6. Delete the Firestore user document
  await admin.firestore().collection("users").doc(userId).delete();

  return { success: true, message: `User ${userId} permanently deleted.` };
});
