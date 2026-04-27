const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

function normalizeRole(role) {
  if (role === "field") {
    return "staff";
  }

  return role || "";
}

async function requireAdminCaller(context) {
  const callerUid = context.auth?.uid;

  if (!callerUid) {
    throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerProfileSnapshot = await admin.firestore().collection("users").doc(callerUid).get();

  if (!callerProfileSnapshot.exists || normalizeRole(callerProfileSnapshot.data()?.role) !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Only admins can perform this action.");
  }

  return callerUid;
}

exports.createStaffUser = functions.https.onCall(async (data, context) => {
  try {
    await requireAdminCaller(context);

    const email = String(data?.email || "").trim().toLowerCase();
    const password = String(data?.password || "");
    const name = String(data?.name || "").trim();
    const role = normalizeRole(String(data?.role || "staff").trim());

    if (!email || !password || !name || !role) {
      throw new functions.https.HttpsError("invalid-argument", "Name, email, password, and role are required.");
    }

    if (!["staff", "admin"].includes(role)) {
      throw new functions.https.HttpsError("invalid-argument", "Role must be staff or admin.");
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.firestore().collection("users").doc(userRecord.uid).set({
      name,
      role,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      uid: userRecord.uid,
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (error?.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError("already-exists", "This email is already registered.");
    }

    console.error("createStaffUser failed:", error);
    return {
      success: false,
      message: error.message || "Unable to create staff user.",
    };
  }
});

exports.deleteStaffUser = functions.https.onCall(async (data, context) => {
  try {
    await requireAdminCaller(context);

    const uid = String(data?.uid || "").trim();

    if (!uid) {
      throw new functions.https.HttpsError("invalid-argument", "A staff uid is required.");
    }

    await admin.auth().deleteUser(uid);
    await admin.firestore().collection("users").doc(uid).delete();

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (error?.code === "auth/user-not-found") {
      throw new functions.https.HttpsError("not-found", "This staff account no longer exists.");
    }

    console.error("deleteStaffUser failed:", error);
    return {
      success: false,
      message: error.message || "Unable to delete staff user.",
    };
  }
});
