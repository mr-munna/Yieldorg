import PDFDocument from 'pdfkit';

export interface ReportData {
  month: string;
  totalCollected: number;
  totalExpenses: number;
  netBalance: number;
  defaulters: {
    name: string;
    memberId: string;
    amountDue: number;
  }[];
}

export async function generateTransparencyReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#065f46').text('Yield Organization', { align: 'center' });
    doc.fontSize(14).font('Helvetica').fillColor('#64748b').text('Monthly Transparency Report', { align: 'center' });
    doc.moveDown(2);

    // Report Info
    doc.fontSize(12).fillColor('#0f172a').text(`Report Month: `, { continued: true }).font('Helvetica-Bold').text(data.month);
    doc.font('Helvetica').text(`Generated On: `, { continued: true }).font('Helvetica-Bold').text(new Date().toLocaleDateString());
    doc.moveDown(2);

    // Financial Summary
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('Financial Summary');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#e2e8f0').stroke();
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica').text(`Total Collected Amount: `, { continued: true }).font('Helvetica-Bold').fillColor('#10b981').text(`৳${data.totalCollected.toFixed(2)}`);
    doc.font('Helvetica').fillColor('#0f172a').text(`Total Expenses: `, { continued: true }).font('Helvetica-Bold').fillColor('#ef4444').text(`৳${data.totalExpenses.toFixed(2)}`);
    
    const balanceColor = data.netBalance >= 0 ? '#10b981' : '#ef4444';
    doc.font('Helvetica').fillColor('#0f172a').text(`Net Balance: `, { continued: true }).font('Helvetica-Bold').fillColor(balanceColor).text(`৳${data.netBalance.toFixed(2)}`);
    doc.moveDown(2);

    // Defaulters List
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('Pending Dues (Defaulters)');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor('#e2e8f0').stroke();
    doc.moveDown(1);

    if (data.defaulters.length === 0) {
      doc.fontSize(12).font('Helvetica-Oblique').fillColor('#64748b').text('No pending dues for this month. Excellent!');
    } else {
      data.defaulters.forEach((defaulter, index) => {
        doc.fontSize(12).font('Helvetica').fillColor('#0f172a')
           .text(`${index + 1}. ${defaulter.name} (${defaulter.memberId}) - `, { continued: true })
           .font('Helvetica-Bold').fillColor('#ef4444').text(`৳${defaulter.amountDue.toFixed(2)} Due`);
      });
    }

    // Footer
    doc.moveDown(4);
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#94a3b8').text('This is an automatically generated transparency report by Yield Organization.', { align: 'center' });

    doc.end();
  });
}
