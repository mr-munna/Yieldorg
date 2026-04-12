import cron from 'node-cron';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { generateTransparencyReport, ReportData } from './pdfGenerator.js';

dotenv.config();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.warn('Firebase Admin initialization failed. Ensure you have set up service account credentials.', error);
  }
}

// --- NOTIFICATION CONFIGURATIONS ---

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'dummy@example.com',
    pass: process.env.EMAIL_PASS || 'dummy',
  },
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || 'ACdummy',
  process.env.TWILIO_AUTH_TOKEN || 'dummy'
);

/**
 * LOGIC: Check Dates and Trigger Notifications
 */
export async function processReminders() {
  console.log('Running monthly payment reminder check...');

  try {
    const db = admin.firestore();
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); 

    const paymentsSnapshot = await db.collection('payments')
      .where('month', '==', currentMonth)
      .where('status', '==', 'Pending')
      .get();

    if (paymentsSnapshot.empty) {
      console.log('No pending payments found for this month. Everyone is paid up!');
      return;
    }

    for (const doc of paymentsSnapshot.docs) {
      const paymentData = doc.data();
      const userDoc = await db.collection('users').doc(paymentData.userId).get();
      
      if (!userDoc.exists) continue;
      const userData = userDoc.data();
      if (!userData) continue;

      const message = `Dear ${userData.name}, your monthly contribution for Yield Organization is due. Please clear it today to avoid late fees.`;

      if (userData.contact && userData.contact.includes('@')) {
        try {
          await transporter.sendMail({
            from: '"Yield Organization" <noreply@yieldorg.com>',
            to: userData.contact,
            subject: 'Action Required: Pending Monthly Dues',
            text: message,
          });
          console.log(`Email sent to ${userData.name} (${userData.contact})`);
        } catch (emailError) {
          console.error(`Failed to send email to ${userData.contact}:`, emailError);
        }
      }
    }
    console.log('All reminders sent successfully.');
  } catch (error) {
    console.error('Error processing reminders:', error);
  }
}

/**
 * LOGIC: Generate and Distribute Monthly Transparency Report
 */
export async function distributeMonthlyReport() {
  console.log('Generating Monthly Transparency Report...');
  try {
    const db = admin.firestore();
    
    // Get previous month (e.g., if today is May 1st, we want April's report)
    const today = new Date();
    today.setMonth(today.getMonth() - 1);
    const targetMonth = today.toISOString().slice(0, 7); // YYYY-MM

    // 1. Calculate Total Collected
    const paymentsSnapshot = await db.collection('payments')
      .where('month', '==', targetMonth)
      .get();

    let totalCollected = 0;
    const defaulters: ReportData['defaulters'] = [];

    for (const doc of paymentsSnapshot.docs) {
      const p = doc.data();
      if (p.status === 'Paid') {
        totalCollected += p.amountPaid;
      } else {
        // Fetch user details for defaulters
        const userDoc = await db.collection('users').doc(p.userId).get();
        const userData = userDoc.data();
        if (userData) {
          defaulters.push({
            name: userData.name,
            memberId: userData.memberId,
            amountDue: p.amountDue - (p.amountPaid || 0) + (p.fine || 0)
          });
        }
      }
    }

    // 2. Calculate Total Expenses (Assuming an 'expenses' collection exists)
    let totalExpenses = 0;
    try {
      const expensesSnapshot = await db.collection('expenses')
        .where('month', '==', targetMonth)
        .get();
      expensesSnapshot.forEach(doc => {
        totalExpenses += doc.data().amount || 0;
      });
    } catch (e) {
      console.log('No expenses collection found or error reading it. Defaulting to 0.');
    }

    const netBalance = totalCollected - totalExpenses;

    // 3. Generate PDF Buffer
    const reportData: ReportData = {
      month: targetMonth,
      totalCollected,
      totalExpenses,
      netBalance,
      defaulters
    };

    const pdfBuffer = await generateTransparencyReport(reportData);

    // 4. Distribute to all active members via Email
    const usersSnapshot = await db.collection('users').where('status', '==', 'Active').get();
    const emailList = usersSnapshot.docs
      .map(doc => doc.data().contact)
      .filter(email => email && email.includes('@'));

    if (emailList.length > 0) {
      await transporter.sendMail({
        from: '"Yield Organization" <noreply@yieldorg.com>',
        to: emailList, // Sends to all active members
        subject: `Transparency Report - ${targetMonth}`,
        text: `Dear Member,\n\nPlease find attached the Monthly Transparency Report for ${targetMonth}.\n\nRegards,\nYield Organization`,
        attachments: [
          {
            filename: `Yield_Report_${targetMonth}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
      console.log(`Transparency report emailed to ${emailList.length} members.`);
    }

    // 5. Distribute via WhatsApp Group (Twilio API)
    // Note: Twilio requires a pre-approved template for WhatsApp broadcasts outside the 24-hour window.
    // If you have a WhatsApp Group linked to a Twilio number, you can send it like this:
    /*
    const groupWhatsAppNumber = process.env.WHATSAPP_GROUP_ID; // e.g., 'whatsapp:+1234567890'
    if (groupWhatsAppNumber) {
      // Since Twilio API doesn't natively send files as buffers directly via WhatsApp easily without a public URL,
      // you would typically upload the PDF to Firebase Storage first, get a public URL, and send the URL.
      // For this example, we send a summary text.
      const summaryMsg = `*Yield Org Report: ${targetMonth}*\nCollected: $${totalCollected}\nExpenses: $${totalExpenses}\nNet: $${netBalance}\nDefaulters: ${defaulters.length}`;
      await twilioClient.messages.create({
        body: summaryMsg,
        from: 'whatsapp:+14155238886', // Your Twilio Sandbox Number
        to: groupWhatsAppNumber
      });
      console.log('WhatsApp summary sent to group.');
    }
    */

  } catch (error) {
    console.error('Error generating/distributing report:', error);
  }
}

export function startCronJobs() {
  // Reminder Cron: 11th of every month at 9:00 AM
  cron.schedule('0 9 11 * *', () => {
    console.log('Triggering payment reminders...');
    processReminders();
  }, { scheduled: true, timezone: "America/New_York" });

  // Transparency Report Cron: 1st of every month at 10:00 AM (Reports on the previous month)
  cron.schedule('0 10 1 * *', () => {
    console.log('Triggering monthly transparency report...');
    distributeMonthlyReport();
  }, { scheduled: true, timezone: "America/New_York" });

  console.log('Cron jobs initialized.');
}
