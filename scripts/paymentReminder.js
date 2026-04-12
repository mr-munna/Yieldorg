require('dotenv').config();
const cron = require('node-cron');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

/**
 * SETUP INSTRUCTIONS:
 * 1. This script is designed to run on a Node.js backend server or as a Firebase Cloud Function.
 * 2. You need a Firebase Service Account key to initialize `firebase-admin`.
 * 3. Set up your environment variables (.env) with your Email/Twilio credentials.
 */

// Initialize Firebase Admin (Uncomment and provide your service account key path)
// const serviceAccount = require('./path-to-your-firebase-service-account-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

const db = admin.firestore();

// --- NOTIFICATION CONFIGURATIONS ---

// 1. Nodemailer Setup (Email)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your SMTP provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 2. Twilio Setup (WhatsApp)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * LOGIC: Check Dates and Trigger Notifications
 */
async function processReminders() {
  console.log('Running monthly payment reminder check...');

  // 1. Get current month in YYYY-MM format
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7); 

  try {
    // 2. Query the database for 'Pending' payments for the current month
    const paymentsSnapshot = await db.collection('payments')
      .where('month', '==', currentMonth)
      .where('status', '==', 'Pending')
      .get();

    if (paymentsSnapshot.empty) {
      console.log('No pending payments found for this month. Everyone is paid up!');
      return;
    }

    // 3. Loop through pending payments and send notifications
    for (const doc of paymentsSnapshot.docs) {
      const paymentData = doc.data();
      
      // Fetch the user's profile to get their contact info (email/phone)
      const userDoc = await db.collection('users').doc(paymentData.userId).get();
      
      if (!userDoc.exists) continue;
      const userData = userDoc.data();

      const message = `Dear ${userData.name}, your monthly contribution for Yield Organization is due. Please clear it today to avoid late fees.`;

      // --- SEND EMAIL ---
      if (userData.contact && userData.contact.includes('@')) {
        await transporter.sendMail({
          from: '"Yield Organization" <noreply@yieldorg.com>',
          to: userData.contact,
          subject: 'Action Required: Pending Monthly Dues',
          text: message,
        });
        console.log(`Email sent to ${userData.name} (${userData.contact})`);
      }

      // --- SEND WHATSAPP (Optional) ---
      // Assuming userData.phone contains their WhatsApp number (e.g., +1234567890)
      /*
      if (userData.phone) {
        await twilioClient.messages.create({
          body: message,
          from: 'whatsapp:+14155238886', // Your Twilio WhatsApp Sandbox number
          to: `whatsapp:${userData.phone}`
        });
        console.log(`WhatsApp sent to ${userData.name}`);
      }
      */
    }

    console.log('All reminders sent successfully.');

  } catch (error) {
    console.error('Error processing reminders:', error);
  }
}

/**
 * CRON SCHEDULE
 * The cron expression '0 9 11 * *' means:
 * - 0: At minute 0
 * - 9: At hour 9 (9:00 AM)
 * - 11: On day-of-month 11
 * - *: Every month
 * - *: Every day-of-week
 */
cron.schedule('0 9 11 * *', () => {
  console.log('Triggering scheduled task for the 11th of the month...');
  processReminders();
}, {
  scheduled: true,
  timezone: "America/New_York" // Adjust to your local timezone
});

console.log('Reminder system initialized. Waiting for the 11th of the month...');

// Uncomment below to test the function immediately without waiting for the 11th
// processReminders();
