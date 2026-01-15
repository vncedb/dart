import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface ReportData {
  userName: string;
  userTitle: string;
  reportTitle: string;
  period: string;
  data: {
      date: string;
      summary: string;
      clockIn: string;
      clockOut: string;
  }[];
  style: 'corporate' | 'creative' | 'minimal';
  paperSize: 'Letter' | 'A4' | 'Legal';
  signatureUri?: string | null; // Added
}

export const generateReport = async (options: ReportData) => {
  const { userName, userTitle, reportTitle, period, data, style, paperSize, signatureUri } = options;

  const themes = {
    corporate: { primary: '#1e293b', accent: '#3b82f6', bg: '#f8fafc', headerText: '#fff' },
    creative: { primary: '#6366f1', accent: '#a855f7', bg: '#fdf4ff', headerText: '#fff' },
    minimal: { primary: '#000000', accent: '#000000', bg: '#ffffff', headerText: '#000' }
  };
  const t = themes[style];

  const rows = data.map((d, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
        <td class="date-col">
            <div class="day">${new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div class="date">${new Date(d.date).getDate()}</div>
        </td>
        <td class="time-col">
            <div class="time-in">IN: ${d.clockIn}</div>
            <div class="time-out">OUT: ${d.clockOut}</div>
        </td>
        <td class="task-col">${d.summary || '<span class="empty">No tasks recorded</span>'}</td>
    </tr>
  `).join('');

  const signatureHtml = signatureUri ? 
      `<img src="${signatureUri}" style="height: 50px; display: block; margin-bottom: 5px;" />` : 
      `<div style="height: 40px; margin-bottom: 5px;"></div>`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @page { size: ${paperSize}; margin: 1.5cm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #334155; }
          .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 3px solid ${t.primary}; margin-bottom: 30px; }
          .title { font-size: 26px; font-weight: 800; color: ${t.primary}; text-transform: uppercase; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; font-weight: 600; }
          .meta-grid { display: flex; gap: 40px; margin-bottom: 40px; }
          .meta-item { flex: 1; }
          .label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
          .value { font-size: 16px; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; text-transform: uppercase; font-size: 10px; color: #64748b; padding: 10px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 12px 10px; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
          .date-col { width: 60px; text-align: center; border-right: 1px solid #f1f5f9; }
          .day { font-size: 9px; font-weight: 700; text-transform: uppercase; color: ${t.accent}; }
          .date { font-size: 18px; font-weight: 800; color: #1e293b; }
          .time-col { width: 100px; }
          .time-in { color: #15803d; font-weight: 600; font-size: 11px; margin-bottom: 2px; }
          .time-out { color: #b45309; font-weight: 600; font-size: 11px; }
          .task-col { line-height: 1.5; color: #334155; }
          .empty { font-style: italic; color: #cbd5e1; }
          .footer { margin-top: 50px; display: flex; gap: 40px; page-break-inside: avoid; }
          .sign-box { flex: 1; }
          .sign-line { border-bottom: 1px solid #000; margin-bottom: 8px; }
          .sign-name { font-weight: bold; font-size: 14px; }
          .sign-role { font-size: 11px; color: #64748b; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><div class="title">${reportTitle}</div><div class="subtitle">Generated via DART App</div></div>
          <div style="text-align: right;"><div class="label">PERIOD</div><div style="font-size: 14px; font-weight:bold; color: ${t.primary};">${period}</div></div>
        </div>

        <div class="meta-grid">
           <div class="meta-item"><div class="label">EMPLOYEE</div><div class="value">${userName}</div></div>
           <div class="meta-item"><div class="label">POSITION</div><div class="value">${userTitle}</div></div>
           <div class="meta-item"><div class="label">DATE GENERATED</div><div class="value">${new Date().toLocaleDateString()}</div></div>
        </div>

        <table>
          <thead><tr><th>Date</th><th>Attendance</th><th>Accomplishments Summary</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
           <div class="sign-box">
              ${signatureHtml}
              <div class="sign-line"></div>
              <div class="sign-name">${userName}</div>
              <div class="sign-role">Employee Signature</div>
           </div>
           <div class="sign-box">
              <div style="height: 45px;"></div>
              <div class="sign-line"></div>
              <div class="sign-name"></div>
              <div class="sign-role">Supervisor Signature</div>
           </div>
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri);
};