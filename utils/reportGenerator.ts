// FIXED: Import from legacy to resolve deprecation errors in SDK 52+
import * as FileSystem from 'expo-file-system/legacy';
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
    dateFormat?: string;
    orientation?: 'portrait' | 'landscape';
}

const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
        if (!uri) return '';
        if (uri.startsWith('data:') || uri.startsWith('http')) return uri;
        
        let processUri = uri;
        if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
            if (uri.startsWith('/')) {
                processUri = 'file://' + uri;
            } else {
                processUri = FileSystem.documentDirectory + uri;
            }
        }

        const base64 = await FileSystem.readAsStringAsync(processUri, { encoding: 'base64' });
        return `data:image/jpeg;base64,${base64}`;
    } catch (e) {
        console.warn("Failed to convert image to base64:", e);
        return uri;
    }
};

// HELPER FUNCTIONS
const getTaskTextHtml = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return '<span style="color:#bdc3c7; font-style:italic;">No entries</span>';
    return `
        <ul class="task-list">
            ${tasks.map((t: any) => `
                <li>
                    <div class="task-content">
                        <span class="task-desc" style="font-weight:600">${t.description}</span>
                        ${t.remarks ? `<div class="task-rem">${t.remarks}</div>` : ''}
                    </div>
                </li>
            `).join('')}
        </ul>
    `;
};

const getDocumentationHtml = (reportData: any[]) => {
    const tasksWithImages: any[] = [];
    reportData.forEach(day => {
        if (day.summary && Array.isArray(day.summary)) {
            day.summary.forEach((task: any) => {
                if (task.images && task.images.length > 0) {
                     const plainDate = day.date.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                     tasksWithImages.push({
                        date: plainDate,
                        desc: task.description,
                        imgs: task.images
                    });
                }
            });
        }
    });

    if (tasksWithImages.length === 0) return '';

    return `
        <div class="page-break"></div>
        <div class="doc-section">
            <div class="doc-header">Documentation Appendix</div>
            <div class="doc-grid">
                ${tasksWithImages.map(item => `
                    <div class="doc-card">
                        <div class="doc-meta">
                            <span class="doc-date">${item.date}</span>
                            <span class="doc-desc">${item.desc}</span>
                        </div>
                        <div class="img-container">
                            ${item.imgs.map((img: string) => `
                                <div class="img-wrapper">
                                    <img src="${img}" />
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

export const generateReport = async ({ 
    userName, userTitle, reportTitle, period, data, style = 'corporate', paperSize = 'Letter', signatureUri, columns, orientation = 'portrait' 
}: ReportData) => {
    
    let safeSignature = null;
    if (signatureUri) {
        safeSignature = await convertImageToBase64(signatureUri);
    }

    const processedData = await Promise.all(data.map(async (day) => {
        const processedTasks = await Promise.all((day.summary || []).map(async (task: any) => {
            const processedImages = await Promise.all((task.images || []).map(async (img: string) => {
                return await convertImageToBase64(img);
            }));
            return { ...task, images: processedImages };
        }));
        
        const displayDate = day.date.replace('\n', '<br/><span style="font-size: 8px; font-weight: 500; color: #666; text-transform: uppercase;">');
        const finalDate = displayDate.includes('<br/>') ? displayDate + '</span>' : displayDate;

        return { ...day, summary: processedTasks, date: finalDate };
    }));

    const configs = {
        corporate: {
            font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            primary: '#1e293b', 
            secondary: '#64748b',
            accent: '#334155',
            headerBg: '#f8fafc',
            thBg: '#1e293b',
            thTxt: '#ffffff',
            radius: '4px',
            border: '#e2e8f0',
            shadow: 'none'
        },
        creative: {
            font: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            primary: '#4f46e5', 
            secondary: '#6366f1',
            accent: '#818cf8',
            headerBg: '#eff6ff',
            thBg: '#4f46e5',
            thTxt: '#ffffff',
            radius: '12px',
            border: '#e0e7ff',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        },
        minimal: {
            font: "Courier, monospace",
            primary: '#000000',
            secondary: '#555555',
            accent: '#000000',
            headerBg: '#ffffff',
            thBg: '#ffffff',
            thTxt: '#000000',
            radius: '0px',
            border: '#000000',
            shadow: 'none'
        }
    };

    const t = configs[style];

    // PAPER DIMENSIONS (Points 72 DPI)
    // Letter: 612x792, A4: 595x842, Legal: 612x1008
    const sizeMap: any = {
        'Letter': { w: 612, h: 792 },
        'A4': { w: 595, h: 842 },
        'Legal': { w: 612, h: 1008 }
    };

    const dims = sizeMap[paperSize] || sizeMap['Letter'];
    // Swap for landscape
    const finalWidth = orientation === 'landscape' ? dims.h : dims.w;
    const finalHeight = orientation === 'landscape' ? dims.w : dims.h;

    const margin = '0.4in';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page { 
                size: ${paperSize} ${orientation}; 
                margin: ${margin}; 
            }
            * { box-sizing: border-box; }
            body { 
                font-family: ${t.font}; 
                color: ${t.primary}; 
                margin: 0; 
                width: 100%;
                -webkit-print-color-adjust: exact; 
            }
            
            .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-end; 
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: ${style === 'minimal' ? '2px solid #000' : `3px solid ${t.primary}`};
            }
            .title-block h1 { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; text-transform: uppercase; }
            .title-block p { font-size: 11px; color: ${t.secondary}; margin: 4px 0 0 0; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
            
            .date-block { text-align: right; }
            .date-block .label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: ${t.secondary}; }
            .date-block .value { font-size: 12px; font-weight: 600; }

            .meta { 
                display: grid; 
                grid-template-columns: 1fr 1fr 1fr; 
                gap: 20px; 
                background: ${t.headerBg}; 
                padding: 16px; 
                border-radius: ${t.radius}; 
                margin-bottom: 30px; 
                border: 1px solid ${t.border};
                ${style === 'creative' ? `box-shadow: ${t.shadow};` : ''}
            }
            .meta-item label { display: block; font-size: 9px; text-transform: uppercase; color: ${t.secondary}; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
            .meta-item span { font-size: 14px; font-weight: 700; color: ${t.primary}; display: block; }

            table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; margin-bottom: 20px; table-layout: fixed; }
            
            th { 
                text-align: left; 
                background-color: ${t.thBg}; 
                color: ${t.thTxt}; 
                padding: 10px; 
                font-weight: 700;
                text-transform: uppercase; 
                font-size: 9px; 
                letter-spacing: 0.5px;
                ${style === 'creative' ? 'border-radius: 6px 6px 0 0;' : ''}
            }
            th.center-align { text-align: center; }

            ${style === 'creative' ? 'th:first-child { border-top-left-radius: 8px; } th:last-child { border-top-right-radius: 8px; }' : ''}

            td { padding: 10px; border-bottom: 1px solid ${t.border}; vertical-align: top; word-wrap: break-word; }
            td.center-align { text-align: center; font-weight: 700; }
            
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: ${style === 'minimal' ? '#fff' : '#f8fafc'}; }

            .task-list { margin: 0; padding-left: 0; list-style-type: none; }
            .task-list li { margin-bottom: 6px; display: flex; align-items: flex-start; }
            .task-list li::before { content: "•"; color: ${t.secondary}; font-weight: bold; margin-right: 6px; }
            .task-content { flex: 1; }
            .task-desc { font-weight: 600; font-size: 11px; display: block; }
            .task-rem { font-size: 10px; color: ${t.secondary}; margin-top: 1px; font-style: italic; }

            .time-record { font-size: 10px; }
            .time-row { margin-bottom: 2px; white-space: nowrap; }
            .time-label { color: ${t.secondary}; font-weight: 700; font-size: 8px; text-transform: uppercase; margin-right: 4px; }
            .time-val { font-weight: 600; }

            .signature-section { 
                margin-top: 50px; 
                page-break-inside: avoid; 
                width: 250px; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
            }
            .sig-img { height: 60px; max-width: 200px; margin-bottom: -10px; z-index: 10; position: relative; }
            .sig-line { width: 100%; border-bottom: 1px solid ${t.primary}; margin-bottom: 8px; }
            .sig-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: ${t.secondary}; letter-spacing: 0.5px; text-align: center; }

            .page-break { page-break-before: always; }
            .doc-section { margin-top: 0px; }
            .doc-header { 
                font-size: 14px; font-weight: 800; color: ${t.primary}; border-bottom: 2px solid ${t.border}; 
                padding-bottom: 10px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; 
            }
            .doc-card { margin-bottom: 20px; page-break-inside: avoid; border: 1px solid ${t.border}; border-radius: ${t.radius}; overflow: hidden; }
            .doc-meta { background: ${t.headerBg}; padding: 10px 15px; border-bottom: 1px solid ${t.border}; display: flex; align-items: center; gap: 10px; }
            .doc-date { font-size: 10px; font-weight: 700; color: ${t.secondary}; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid ${t.border}; }
            .doc-desc { font-size: 11px; font-weight: 700; color: ${t.primary}; }

            .img-container { padding: 10px; display: flex; flex-wrap: wrap; gap: 10px; background: #fff; justify-content: flex-start; }
            
            .img-wrapper { 
                width: 48%; 
                aspect-ratio: 4 / 3; 
                border-radius: 4px; 
                overflow: hidden; 
                border: 1px solid ${t.border}; 
                background: #fafafa;
                display: flex; 
                align-items: center; 
                justify-content: center; 
            }
            .img-wrapper img { width: 100%; height: 100%; object-fit: contain; }

            .footer { position: fixed; bottom: 0; left: 0; right: 0; height: 30px; border-top: 1px solid ${t.border}; display: flex; align-items: center; justify-content: center; }
            .footer-text { font-size: 8px; color: #94a3b8; font-weight: 600; letter-spacing: 1px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title-block">
                <h1>${reportTitle}</h1>
                <p>Employee Activity Record</p>
            </div>
            <div class="date-block">
                <div class="label">Date Generated</div>
                <div class="value">${new Date().toLocaleDateString()}</div>
            </div>
        </div>

        <div class="meta">
            <div class="meta-item"><label>Employee Name</label><span>${userName}</span></div>
            <div class="meta-item"><label>Job Title</label><span>${userTitle}</span></div>
            <div class="meta-item"><label>Report Period</label><span>${period}</span></div>
        </div>

        <table>
            <colgroup>
                <col style="width: 12%;"> 
                ${columns?.time ? `<col style="width: 15%;">` : ''} 
                ${columns?.duration ? `<col style="width: 10%;">` : ''} 
                <col style="width: auto;"> 
                ${columns?.remarks ? `<col style="width: 25%;">` : ''} 
            </colgroup>
            <thead>
                <tr>
                    <th>Date</th>
                    ${columns?.time ? `<th>Time Record</th>` : ''}
                    ${columns?.duration ? `<th class="center-align">Hours</th>` : ''}
                    <th>ACCOMPLISHMENTS</th>
                    ${columns?.remarks ? `<th>Remarks</th>` : ''}
                </tr>
            </thead>
            <tbody>
                ${processedData.map((item: any) => `
                    <tr>
                        <td style="white-space: pre-line;"><strong>${item.date}</strong></td>
                        ${columns?.time ? `
                            <td>
                                <div class="time-row"><span class="time-label">IN:</span><span class="time-val">${item.clockIn}</span></div>
                                <div class="time-row"><span class="time-label">OUT:</span><span class="time-val">${item.clockOut}</span></div>
                            </td>` : ''}
                        ${columns?.duration ? `<td class="center-align">${item.duration}</td>` : ''}
                        <td>${getTaskTextHtml(item.summary)}</td>
                        ${columns?.remarks ? `<td><span style="font-size:10px; color:${t.secondary}">${item.remarks || '-'}</span></td>` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${safeSignature ? `
            <div class="signature-section">
                <img src="${safeSignature}" class="sig-img" />
                <div class="sig-line"></div>
                <div class="sig-label">Authorized Signature</div>
            </div>
        ` : ''}

        ${getDocumentationHtml(processedData)}

        <div class="footer">
            <span class="footer-text">System Generated Report | DART</span>
        </div>
    </body>
    </html>
    `;

    // Explicitly pass width/height to override Expo default
    const { uri } = await Print.printToFileAsync({ 
        html, 
        width: finalWidth, 
        height: finalHeight 
    });
    return uri;
};