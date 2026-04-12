import admin from 'firebase-admin';

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (e) {
  // Already initialized or error
}

async function resetPassword() {
  const email = 'bijoy.mm112@gmail.com';
  const newPassword = '686622';
  
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    console.log(`SUCCESS: Password for ${email} has been updated to ${newPassword}`);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log(`USER_NOT_FOUND: ${email} does not exist yet.`);
    } else {
      console.error('ERROR:', error);
    }
  }
}

resetPassword();
