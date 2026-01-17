import * as Print from 'expo-print';

interface ReportData {
    userName: string;
    userTitle: string;
    reportTitle: string;
    period: string;
    data: any[];
    style?: 'corporate' | 'creative' | 'minimal';
    paperSize?: 'Letter' | 'A4' | 'Legal';
    signatureUri?: string | null;
    columns?: any;
}

export const generateReport = async ({ 
    userName, userTitle, reportTitle, period, data, style = 'corporate', paperSize = 'Letter', signatureUri, columns 
}: ReportData) => {
    
    // Theme Colors
    const colors = {
        corporate: { header: '#2c3e50', text: '#333', accent: '#ecf0f1', thBg: '#34495e', thTxt: '#fff' },
        creative: { header: '#6c5ce7', text: '#2d3436', accent: '#a29bfe', thBg: '#6c5ce7', thTxt: '#fff' },
        minimal: { header: '#000', text: '#000', accent: '#fff', thBg: '#fff', thTxt: '#000' }
    }[style];

    const borderStyle = style === 'minimal' ? '1px solid #000' : 'none';

    // Helper: Tasks & Images
    const getTaskHtml = (tasks: any[]) => {
        if (!tasks || tasks.length === 0) return '<span style="color:#bdc3c7; font-style:italic;">No entries</span>';
        return `
            <ul class="task-list">
                ${tasks.map((t: any) => `
                    <li>
                        <div class="task-desc">${t.description}</div>
                        ${t.remarks ? `<div class="task-rem">${t.remarks}</div>` : ''}
                        ${t.image_url ? `<div class="task-img"><img src="${t.image_url}" /></div>` : ''}
                    </li>
                `).join('')}
            </ul>
        `;
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page { size: ${paperSize}; margin: 1.25cm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${colors.text}; margin: 0; }
            
            .header { border-bottom: 3px solid ${colors.header}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: 900; text-transform: uppercase; color: ${colors.header}; }
            .subtitle { font-size: 11px; color: #7f8c8d; margin-top: 4px; }
            .brand { font-size: 9px; font-weight: 700; color: #95a5a6; text-transform: uppercase; }

            .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; background: ${style === 'minimal' ? '#fff' : '#f8f9fa'}; padding: 12px; border-radius: 6px; margin-bottom: 25px; border: ${borderStyle}; }
            .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: #95a5a6; font-weight: 700; margin-bottom: 2px; }
            .meta-item span { font-size: 13px; font-weight: 700; color: ${colors.header}; }

            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; background-color: ${colors.thBg}; color: ${colors.thTxt}; padding: 10px; border-bottom: 2px solid ${colors.header}; text-transform: uppercase; font-size: 9px; }
            td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }
            tr:nth-child(even) { background-color: ${style === 'minimal' ? '#fff' : '#fcfcfc'}; }

            .task-list { margin: 0; padding-left: 15px; list-style-type: disc; }
            .task-desc { font-weight: 600; font-size: 11px; }
            .task-rem { font-size: 9px; color: #7f8c8d; font-style: italic; margin-top: 2px; }
            .task-img img { max-width: 120px; max-height: 80px; margin-top: 6px; border-radius: 4px; border: 1px solid #eee; object-fit: cover; }

            .signature-section { margin-top: 50px; page-break-inside: avoid; }
            .sig-line { width: 220px; border-bottom: 1px solid #333; margin-bottom: 5px; }
            .sig-img { height: 50px; margin-bottom: -15px; margin-left: 10px; }
            .sig-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: ${colors.header}; }

            .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8px; color: #bdc3c7; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="title">${reportTitle}</div>
                <div class="subtitle">Official Record • ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="brand">Generated via DART</div>
        </div>

        <div class="meta">
            <div class="meta-item"><label>Employee</label><span>${userName}</span></div>
            <div class="meta-item"><label>Position</label><span>${userTitle}</span></div>
            <div class="meta-item"><label>Period</label><span>${period}</span></div>
        </div>

        <table>
            <thead>
                <tr>
                    ${columns?.date ? `<th width="12%">Date</th>` : ''}
                    ${columns?.time ? `<th width="18%">Time Record</th>` : ''}
                    ${columns?.duration ? `<th width="10%">Duration</th>` : ''}
                    ${columns?.activities ? `<th>Activities / Documentation</th>` : ''}
                    ${columns?.remarks ? `<th width="15%">Remarks</th>` : ''}
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr>
                        ${columns?.date ? `<td><strong>${item.date}</strong></td>` : ''}
                        ${columns?.time ? `<td>${item.clockIn}<br/><span style="color:#95a5a6">${item.clockOut}</span></td>` : ''}
                        ${columns?.duration ? `<td><strong>${item.duration}</strong></td>` : ''}
                        ${columns?.activities ? `<td>${getTaskHtml(item.summary)}</td>` : ''}
                        ${columns?.remarks ? `<td>${item.remarks || ''}</td>` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${signatureUri ? `
            <div class="signature-section">
                <img src="${signatureUri}" class="sig-img" />
                <div class="sig-line"></div>
                <div class="sig-label">Employee Signature</div>
            </div>
        ` : ''}

        <div class="footer">
            System Generated Report | DART App
        </div>
    </body>
    </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
};