import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { generateTransparencyReport } from './pdfGenerator.ts';
import type { ReportData } from './pdfGenerator.ts';

dotenv.config();

// Initialize Firebase App & Firestore using config file
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.error('Error reading firebase-applet-config.json in cron.ts', e);
  }
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

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
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); 

    const q = query(
      collection(db, 'payments'),
      where('month', '==', currentMonth),
      where('status', '==', 'Pending')
    );
    const paymentsSnapshot = await getDocs(q);

    if (paymentsSnapshot.empty) {
      console.log('No pending payments found for this month. Everyone is paid up!');
      return;
    }

    for (const pDoc of paymentsSnapshot.docs) {
      const paymentData = pDoc.data();
      if (!paymentData.userId) continue;
      
      const userDocRef = doc(db, 'users', paymentData.userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) continue;
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
    const today = new Date();
    today.setMonth(today.getMonth() - 1);
    const targetMonth = today.toISOString().slice(0, 7); // YYYY-MM

    // 1. Calculate Total Collected
    const qPayments = query(collection(db, 'payments'), where('month', '==', targetMonth));
    const paymentsSnapshot = await getDocs(qPayments);

    let totalCollected = 0;
    const defaulters: ReportData['defaulters'] = [];

    for (const pDoc of paymentsSnapshot.docs) {
      const p = pDoc.data();
      if (p.status === 'Paid') {
        totalCollected += p.amountPaid;
      } else {
        if (p.userId) {
          const userDoc = await getDoc(doc(db, 'users', p.userId));
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
    }

    // 2. Calculate Total Expenses
    let totalExpenses = 0;
    try {
      const qExpenses = query(collection(db, 'expenses'), where('month', '==', targetMonth));
      const expensesSnapshot = await getDocs(qExpenses);
      expensesSnapshot.forEach(eDoc => {
        totalExpenses += eDoc.data().amount || 0;
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
    const qActiveUsers = query(collection(db, 'users'), where('status', '==', 'Active'));
    const usersSnapshot = await getDocs(qActiveUsers);
    const emailList = usersSnapshot.docs
      .map(uDoc => uDoc.data().contact)
      .filter(email => email && email.includes('@'));

    if (emailList.length > 0) {
      await transporter.sendMail({
        from: '"Yield Organization" <noreply@yieldorg.com>',
        to: emailList,
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

  } catch (error) {
    console.error('Error generating/distributing report:', error);
  }
}

export function startCronJobs() {
  // Reminder Cron: 11th of every month at 9:00 AM
  cron.schedule('0 9 11 * *', () => {
    console.log('Triggering payment reminders...');
    processReminders();
  }, { timezone: "America/New_York" });

  // Transparency Report Cron: 1st of every month at 10:00 AM (Reports on the previous month)
  cron.schedule('0 10 1 * *', () => {
    console.log('Triggering monthly transparency report...');
    distributeMonthlyReport();
  }, { timezone: "America/New_York" });

  console.log('Cron jobs initialized.');
}
