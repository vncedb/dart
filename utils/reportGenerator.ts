import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface ReportOptions {
  userName: string;
  userTitle?: string;
  date: string;
  clockIn: string;
  clockOut: string;
  accomplishments: string[];
  style: 'corporate' | 'creative' | 'minimal';
  paperSize: 'Letter' | 'A4' | 'Legal';
  orientation: 'portrait' | 'landscape';
  signatoryName?: string;
  signatoryTitle?: string;
}

export const generateDailyReport = async (options: ReportOptions) => {
  const {
    userName, userTitle = "Employee", date, clockIn, clockOut, accomplishments, 
    style, paperSize, orientation, signatoryName, signatoryTitle
  } = options;

  // CSS for Paper Size and Orientation
  const pageCss = `
    @page {
      size: ${paperSize} ${orientation};
      margin: 0;
    }
    body {
      margin: 2cm;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
    }
  `;

  // Style Variants
  const styles = {
    corporate: {
      headerBg: '#1e293b', headerText: '#ffffff',
      accent: '#3b82f6', border: '2px solid #e2e8f0'
    },
    creative: {
      headerBg: '#6366f1', headerText: '#ffffff',
      accent: '#8b5cf6', border: 'none'
    },
    minimal: {
      headerBg: '#ffffff', headerText: '#0f172a',
      accent: '#000000', border: '1px solid #000'
    }
  };
  
  const currentStyle = styles[style];

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          ${pageCss}
          .container { width: 100%; height: 100%; }
          .header { 
            background: ${currentStyle.headerBg}; 
            color: ${currentStyle.headerText};
            padding: 30px; 
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .title { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
          .meta { margin-top: 10px; font-size: 14px; opacity: 0.9; }
          .section { margin-bottom: 25px; }
          .section-title { 
            font-size: 14px; color: #64748b; font-weight: bold; 
            text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; 
            border-bottom: 2px solid ${currentStyle.accent}; display: inline-block;
          }
          .card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .time-grid { display: flex; gap: 20px; }
          .time-box { flex: 1; text-align: center; background: white; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .time-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
          .time-val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 5px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 8px; color: #334155; line-height: 1.5; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sign-box { width: 200px; text-align: center; }
          .sign-line { border-bottom: 1px solid #0f172a; height: 40px; margin-bottom: 10px; }
          .sign-name { font-weight: bold; color: #0f172a; }
          .sign-role { font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Daily Accomplishment Report</div>
          <div class="meta">${date}</div>
        </div>

        <div class="section">
          <div class="section-title">Employee Details</div>
          <div style="font-size: 18px; font-weight: bold;">${userName}</div>
          <div style="color: #64748b;">${userTitle}</div>
        </div>

        <div class="section">
          <div class="section-title">Attendance</div>
          <div class="time-grid">
            <div class="time-box">
              <div class="time-label">Clock In</div>
              <div class="time-val">${clockIn}</div>
            </div>
            <div class="time-box">
              <div class="time-label">Clock Out</div>
              <div class="time-val">${clockOut}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Accomplishments</div>
          <div class="card">
            ${accomplishments.length > 0 ? `<ul>${accomplishments.map(t => `<li>${t}</li>`).join('')}</ul>` : '<p style="color:#94a3b8; font-style:italic;">No tasks recorded.</p>'}
          </div>
        </div>

        <div class="footer">
          <div class="sign-box">
            <div class="sign-line"></div>
            <div class="sign-name">${userName}</div>
            <div class="sign-role">Employee</div>
          </div>
          ${signatoryName ? `
          <div class="sign-box">
            <div class="sign-line"></div>
            <div class="sign-name">${signatoryName}</div>
            <div class="sign-role">${signatoryTitle || 'Supervisor'}</div>
          </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri);
};