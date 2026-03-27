import { decode as decodeBase64, encode as encodeBase64 } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
const { PNG } = require("pngjs/browser");

interface ReportData {
  userName: string;
  userTitle: string;
  company?: string;
  department?: string;
  reportTitle: string;
  period: string;
  data: any[];
  style?: "corporate" | "creative" | "minimal";
  paperSize?: "Letter" | "A4" | "Legal";
  signatureUri?: string | null;
  secondaryName?: string;
  secondaryTitle?: string;
  secondarySignatureUri?: string | null;
  columns?: any;
  dateFormat?: string;
  totals?: {
    totalDays?: number;
    totalHours?: string;
  };
  onProgress?: (progress: number, message?: string) => void;
}

type FontKey = "F1" | "F2";

type Theme = {
  primary: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
  border: [number, number, number];
  headerBg: [number, number, number];
  rowAlt: [number, number, number];
};

type LoadedImage = {
  key: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  filter: "DCTDecode" | "ASCIIHexDecode";
};

type Page = {
  ops: string[];
  imageKeys: Set<string>;
};

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  Letter: { width: 612, height: 792 },
  A4: { width: 595, height: 842 },
  Legal: { width: 612, height: 1008 },
};

const THEMES: Record<"corporate" | "creative" | "minimal", Theme> = {
  corporate: {
    primary: [0, 113, 188],
    secondary: [22, 78, 131],
    accent: [244, 250, 255],
    border: [120, 207, 255],
    headerBg: [246, 251, 255],
    rowAlt: [255, 255, 255],
  },
  creative: {
    primary: [79, 70, 229],
    secondary: [99, 102, 241],
    accent: [239, 246, 255],
    border: [224, 231, 255],
    headerBg: [239, 246, 255],
    rowAlt: [245, 247, 255],
  },
  minimal: {
    primary: [17, 17, 17],
    secondary: [85, 85, 85],
    accent: [255, 255, 255],
    border: [209, 213, 219],
    headerBg: [255, 255, 255],
    rowAlt: [255, 255, 255],
  },
};

const MARGIN_X = 34;
const TOP_MARGIN = 30;
const BOTTOM_MARGIN = 34;
const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 18;

const rgb = ([r, g, b]: [number, number, number]) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;

const escapePdfText = (value?: string | null) =>
  String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const normalizeText = (value?: string | null) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const bytesToBinaryString = (bytes: Uint8Array) => {
  let result = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return result;
};

const stringToUint8Array = (value: string) => {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
};

const bytesToHexString = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const chunkItems = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const wrapText = (text: string, maxChars: number) => {
  const normalized = normalizeText(text);
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let remainder = word;
    while (remainder.length > maxChars) {
      lines.push(remainder.slice(0, maxChars));
      remainder = remainder.slice(maxChars);
    }
    current = remainder;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const estimateChars = (width: number, fontSize: number) => Math.max(8, Math.floor(width / (fontSize * 0.54)));

const estimateWrappedHeight = (text: string, width: number, fontSize: number, lineHeight: number) =>
  wrapText(text, estimateChars(width, fontSize)).length * lineHeight;

const parseJpegSize = (bytes: Uint8Array) => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;

    const length = (bytes[offset] << 8) + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      if (offset + 7 >= bytes.length) return null;
      const height = (bytes[offset + 3] << 8) + bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) + bytes[offset + 6];
      return { width, height };
    }

    offset += length;
  }

  return null;
};

const loadBinarySource = async (uri: string): Promise<{ key: string; bytes: Uint8Array } | null> => {
  try {
    if (!uri) return null;

    if (uri.startsWith("data:")) {
      const match = uri.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      const bytes = new Uint8Array(decodeBase64(match[2]));
      return { key: uri.slice(0, 64), bytes };
    }

    let sourceUri = uri;
    if (!uri.startsWith("file://") && !uri.startsWith("content://")) {
      sourceUri = uri.startsWith("/") ? `file://${uri}` : `${FileSystem.documentDirectory || ""}${uri}`;
    }

    if (sourceUri.startsWith("content://")) {
      const tempUri = `${FileSystem.cacheDirectory}pdf_asset_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      await FileSystem.copyAsync({ from: sourceUri, to: tempUri });
      sourceUri = tempUri;
    }

    const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: "base64" });
    const bytes = new Uint8Array(decodeBase64(base64));
    return { key: sourceUri, bytes };
  } catch {
    return null;
  }
};

const isPng = (bytes: Uint8Array) =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47 &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a &&
  bytes[6] === 0x1a &&
  bytes[7] === 0x0a;

const loadPngImage = async (key: string, bytes: Uint8Array): Promise<LoadedImage | null> => {
  try {
    const png = PNG.sync.read(bytes);
    const { width, height, data } = png;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < 0 || maxY < 0) {
      return null;
    }

    const padding = 4;
    const cropLeft = Math.max(0, minX - padding);
    const cropTop = Math.max(0, minY - padding);
    const cropRight = Math.min(width - 1, maxX + padding);
    const cropBottom = Math.min(height - 1, maxY + padding);
    const croppedWidth = cropRight - cropLeft + 1;
    const croppedHeight = cropBottom - cropTop + 1;
    const rgbBytes = new Uint8Array(croppedWidth * croppedHeight * 3);

    let offset = 0;
    for (let y = cropTop; y <= cropBottom; y += 1) {
      for (let x = cropLeft; x <= cropRight; x += 1) {
        const base = (y * width + x) * 4;
        const alpha = data[base + 3] / 255;
        rgbBytes[offset] = Math.round(data[base] * alpha + 255 * (1 - alpha));
        rgbBytes[offset + 1] = Math.round(data[base + 1] * alpha + 255 * (1 - alpha));
        rgbBytes[offset + 2] = Math.round(data[base + 2] * alpha + 255 * (1 - alpha));
        offset += 3;
      }
    }

    return {
      key,
      width: croppedWidth,
      height: croppedHeight,
      bytes: rgbBytes,
      filter: "ASCIIHexDecode",
    };
  } catch {
    return null;
  }
};

const loadImage = async (uri?: string | null): Promise<LoadedImage | null> => {
  if (!uri) return null;
  const loaded = await loadBinarySource(uri);
  if (!loaded) return null;
  const size = parseJpegSize(loaded.bytes);
  if (size) {
    return {
      key: loaded.key,
      width: size.width,
      height: size.height,
      bytes: loaded.bytes,
      filter: "DCTDecode",
    };
  }
  if (isPng(loaded.bytes)) {
    return loadPngImage(loaded.key, loaded.bytes);
  }
  return null;
};

const renderPdf = ({
  paperSize,
  pages,
  images,
}: {
  paperSize: "Letter" | "A4" | "Legal";
  pages: Page[];
  images: Map<string, LoadedImage>;
}) => {
  const size = PAGE_SIZES[paperSize] || PAGE_SIZES.Letter;
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const imageObjectIds = new Map<string, { id: number; name: string }>();
  let imageIndex = 1;
  for (const [key, image] of images.entries()) {
    const stream = image.filter === "ASCIIHexDecode" ? `${bytesToHexString(image.bytes)}>` : bytesToBinaryString(image.bytes);
    const streamLength = stream.length;
    const objectId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8${image.filter ? ` /Filter /${image.filter}` : ""} /Length ${streamLength} >>\nstream\n${stream}\nendstream`,
    );
    imageObjectIds.set(key, { id: objectId, name: `Im${imageIndex}` });
    imageIndex += 1;
  }

  const pageIds: number[] = [];

  for (const page of pages) {
    const content = page.ops.join("\n");
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const imageDict = Array.from(page.imageKeys)
      .map((key) => {
        const ref = imageObjectIds.get(key);
        return ref ? `/${ref.name} ${ref.id} 0 R` : "";
      })
      .filter(Boolean)
      .join(" ");

    const resources = `<< /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>${imageDict ? ` /XObject << ${imageDict} >>` : ""} >>`;
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${size.width} ${size.height}] /Resources ${resources} /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return stringToUint8Array(pdf);
};

export const generateReport = async ({
  userName,
  userTitle,
  company,
  department,
  reportTitle,
  period,
  data,
  style = "corporate",
  paperSize = "Letter",
  signatureUri,
  secondaryName,
  secondaryTitle,
  secondarySignatureUri,
  columns,
  totals,
  onProgress,
}: ReportData) => {
  onProgress?.(10, "Preparing report assets...");
  const size = PAGE_SIZES[paperSize] || PAGE_SIZES.Letter;
  const theme = THEMES[style] || THEMES.corporate;
  const contentWidth = size.width - MARGIN_X * 2;
  const pages: Page[] = [];
  const loadedImages = new Map<string, LoadedImage>();

  const processedData = await Promise.all(
    (data || []).map(async (day) => {
      const tasks = await Promise.all(
        (day?.summary || []).map(async (task: any) => {
          const images = await Promise.all((task?.images || []).map((uri: string) => loadImage(uri)));
          images.filter(Boolean).forEach((image) => {
            if (image) loadedImages.set(image.key, image);
          });

          return {
            ...task,
            images: images.filter(Boolean) as LoadedImage[],
          };
        }),
      );

      return {
        ...day,
        plainDate: normalizeText(day?.date || ""),
        appendixDate: String(day?.date || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\r/g, "")
          .replace(/\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        summary: tasks,
      };
    }),
  );
  onProgress?.(35, "Composing report pages...");

  const createPage = () => {
    const page: Page = { ops: [], imageKeys: new Set() };
    pages.push(page);

    const addOp = (value: string) => page.ops.push(value);
    const topToPdfY = (top: number, height = 0) => size.height - top - height;
    const setFill = (color: [number, number, number]) => `${rgb(color)} rg`;
    const setStroke = (color: [number, number, number]) => `${rgb(color)} RG`;

    addOp(`${setFill(theme.primary)} 0 ${topToPdfY(0, HEADER_HEIGHT)} ${size.width} ${HEADER_HEIGHT} re f`);
    addOp(
      `${rgb([255, 255, 255])} rg BT /F2 20 Tf 1 0 0 1 ${MARGIN_X} ${topToPdfY(18, 20)} Tm (${escapePdfText(
        reportTitle,
      )}) Tj ET`,
    );
    addOp(
      `${rgb([255, 255, 255])} rg BT /F1 10 Tf 1 0 0 1 ${MARGIN_X} ${topToPdfY(42, 10)} Tm (DAILY ACTIVITY RECORD) Tj ET`,
    );
    const generatedLabel = `Generated ${new Date().toLocaleDateString()}`;
    const generatedWidth = Math.max(generatedLabel.length, 1) * (9 * 0.52);
    addOp(
      `${rgb([255, 255, 255])} rg BT /F1 9 Tf 1 0 0 1 ${Math.max(MARGIN_X, size.width - MARGIN_X - generatedWidth)} ${topToPdfY(42, 9)} Tm (${escapePdfText(
        generatedLabel,
      )}) Tj ET`,
    );
    addOp(`${setStroke(theme.border)} 1 w ${MARGIN_X} ${FOOTER_HEIGHT} m ${size.width - MARGIN_X} ${FOOTER_HEIGHT} l S`);
    addOp(
      `${rgb(theme.secondary)} rg BT /F1 8 Tf 1 0 0 1 ${MARGIN_X} 8 Tm (System Generated Report | DART) Tj ET`,
    );

    return page;
  };

  let currentPage = createPage();
  let cursorY = TOP_MARGIN + HEADER_HEIGHT + 10;

  const ensureSpace = (height: number) => {
    if (cursorY + height > size.height - BOTTOM_MARGIN - FOOTER_HEIGHT) {
      currentPage = createPage();
      cursorY = TOP_MARGIN + HEADER_HEIGHT + 10;
    }
  };

  const addText = (
    text: string,
    x: number,
    top: number,
    {
      size: fontSize = 10,
      font = "F1" as FontKey,
      color = theme.primary,
    } = {},
  ) => {
    currentPage.ops.push(
      `${rgb(color)} rg BT /${font} ${fontSize} Tf 1 0 0 1 ${x} ${size.height - top - fontSize} Tm (${escapePdfText(text)}) Tj ET`,
    );
  };

  const addCenteredText = (
    text: string,
    x: number,
    top: number,
    width: number,
    {
      size: fontSize = 10,
      font = "F1" as FontKey,
      color = theme.primary,
    } = {},
  ) => {
    const estimatedWidth = Math.max(text.length, 1) * (fontSize * 0.52);
    addText(text, x + Math.max(0, (width - estimatedWidth) / 2), top, { size: fontSize, font, color });
  };

  const addRightAlignedText = (
    text: string,
    rightX: number,
    top: number,
    {
      size: fontSize = 10,
      font = "F1" as FontKey,
      color = theme.primary,
    } = {},
  ) => {
    const estimatedWidth = Math.max(text.length, 1) * (fontSize * 0.52);
    addText(text, Math.max(MARGIN_X, rightX - estimatedWidth), top, { size: fontSize, font, color });
  };

  const addRect = (x: number, top: number, width: number, height: number, fill: [number, number, number], stroke?: [number, number, number]) => {
    const parts = [`${rgb(fill)} rg`];
    if (stroke) parts.push(`${rgb(stroke)} RG`);
    parts.push(`${x} ${size.height - top - height} ${width} ${height} re`);
    parts.push(stroke ? "B" : "f");
    currentPage.ops.push(parts.join("\n"));
  };

  const addLine = (x1: number, top1: number, x2: number, top2: number, color: [number, number, number], width = 1) => {
    currentPage.ops.push(`${rgb(color)} RG ${width} w ${x1} ${size.height - top1} m ${x2} ${size.height - top2} l S`);
  };

  const addWrappedText = (
    text: string,
    x: number,
    top: number,
    width: number,
    {
      size: fontSize = 10,
      font = "F1" as FontKey,
      color = theme.primary,
      lineHeight = 12,
    } = {},
  ) => {
    const lines = wrapText(text, estimateChars(width, fontSize));
    lines.forEach((line, index) => addText(line, x, top + index * lineHeight, { size: fontSize, font, color }));
    return lines.length * lineHeight;
  };

  const estimateInfoValueHeight = (value: string, width: number) =>
    Math.max(13, estimateWrappedHeight(value || "-", width, 11.2, 13));

  const infoRows = [
    [
      { label: "Employee Name", value: normalizeText(userName) || "-" },
      { label: "Company / Organization", value: normalizeText(company) || "-" },
    ],
    [
      { label: "Job Position", value: normalizeText(userTitle) || "-" },
      { label: "Department", value: normalizeText(department) || "-" },
    ],
    [
      { label: "Report Period", value: normalizeText(period) || "-" },
      { label: "Total Hours", value: normalizeText(totals?.totalHours) || "-" },
    ],
  ] as const;

  const includeTime = columns?.time !== false;
  const includeDuration = columns?.duration !== false;
  const dateWidth = 128;
  const timeWidth = includeTime ? 78 : 0;
  const hoursWidth = includeDuration ? 56 : 0;
  const accomplishmentsWidth = contentWidth - dateWidth - timeWidth - hoursWidth;
  const accomplishmentsStartX = MARGIN_X + dateWidth + timeWidth + hoursWidth + 8;
  const infoPadding = 14;
  const leftX = MARGIN_X + infoPadding;
  const rightX = accomplishmentsStartX;
  const infoColGap = Math.max(16, rightX - leftX - 154);
  const leftInfoWidth = rightX - leftX - infoColGap;
  const rightInfoWidth = MARGIN_X + contentWidth - infoPadding - rightX;
  const rowHeights = infoRows.map(([left, right]) =>
    Math.max(28, Math.max(estimateInfoValueHeight(left.value, leftInfoWidth), estimateInfoValueHeight(right.value, rightInfoWidth)) + 14),
  );
  const infoHeight = infoPadding * 2 + rowHeights.reduce((sum, height) => sum + height, 0) + (infoRows.length - 1) * 10;

  ensureSpace(infoHeight + 8);
  const infoTop = cursorY;
  addRect(MARGIN_X, infoTop, contentWidth, infoHeight, [255, 255, 255], theme.border);

  let infoOffset = infoTop + infoPadding;
  infoRows.forEach(([left, right], rowIndex) => {
    const rowHeight = rowHeights[rowIndex];

    addText(left.label.toUpperCase(), leftX, infoOffset, { size: 8.2, font: "F1", color: theme.primary });
    addWrappedText(left.value, leftX, infoOffset + 12, leftInfoWidth, {
      size: 11.2,
      font: "F2",
      color: theme.primary,
      lineHeight: 13,
    });

    addText(right.label.toUpperCase(), rightX, infoOffset, { size: 8.2, font: "F1", color: theme.primary });
    addWrappedText(right.value, rightX, infoOffset + 12, rightInfoWidth, {
      size: 11.2,
      font: "F2",
      color: theme.primary,
      lineHeight: 13,
    });

    infoOffset += rowHeight + (rowIndex < infoRows.length - 1 ? 10 : 0);
  });
  cursorY += infoHeight + 12;
  const imageRegistryNames = new Map<string, string>();
  let imageCounter = 1;
  loadedImages.forEach((_, key) => {
    imageRegistryNames.set(key, `Im${imageCounter}`);
    imageCounter += 1;
  });

  const drawTableHeader = () => {
    ensureSpace(30);
    addRect(MARGIN_X, cursorY, contentWidth, 24, theme.primary);
    addText("DATE", MARGIN_X + 8, cursorY + 7, { size: 9, font: "F2", color: [255, 255, 255] });
    let x = MARGIN_X + dateWidth;
    if (includeTime) {
      addText("TIME RECORD", x + 8, cursorY + 7, { size: 9, font: "F2", color: [255, 255, 255] });
      x += timeWidth;
    }
    if (includeDuration) {
      addCenteredText("HOURS", x, cursorY + 7, hoursWidth, { size: 9, font: "F2", color: [255, 255, 255] });
      x += hoursWidth;
    }
    addText("ACCOMPLISHMENTS", x + 8, cursorY + 7, { size: 9, font: "F2", color: [255, 255, 255] });
    cursorY += 24;
  };

  const drawTableRowShell = (top: number, rowHeight: number, fill: [number, number, number]) => {
    addRect(MARGIN_X, top, contentWidth, rowHeight, fill, theme.border);
    let x = MARGIN_X;
    addLine(x + dateWidth, top, x + dateWidth, top + rowHeight, theme.border);
    if (includeTime) {
      addLine(x + dateWidth + timeWidth, top, x + dateWidth + timeWidth, top + rowHeight, theme.border);
    }
    if (includeDuration) {
      addLine(x + dateWidth + timeWidth + hoursWidth, top, x + dateWidth + timeWidth + hoursWidth, top + rowHeight, theme.border);
    }
  };

  drawTableHeader();

  processedData.forEach((day, rowIndex) => {
    const includeRemarks = columns?.remarks !== false;
    const dateText = normalizeText(day.plainDate || day.date || "");
    const dateFontSize = dateText.length > 28 ? 7.8 : dateText.length > 24 ? 8.4 : dateText.length > 20 ? 9 : 10;
    const dateLines = [dateText || "-"];
    const taskLines = (Array.isArray(day.summary) && day.summary.length > 0
      ? day.summary.flatMap((task: any) => {
          const lines = [`- ${normalizeText(task.description) || "Untitled activity"}`];
          if (includeRemarks && task.remarks) lines.push(`Remarks: ${normalizeText(task.remarks)}`);
          return lines;
        })
      : ["No entries"])
      .flatMap((line: string) => wrapText(line, estimateChars(accomplishmentsWidth - 14, line.startsWith("Remarks:") ? 9.2 : 10)));

    const timeRows = includeTime
      ? [
          { label: "IN", value: normalizeText(day.clockIn) || "--:--" },
          { label: "OUT", value: normalizeText(day.clockOut) || "--:--" },
        ]
      : [];
    const hoursLines = includeDuration ? wrapText(normalizeText(day.duration) || "--", 10) : [];

    const rowLineCount = Math.max(dateLines.length, taskLines.length, timeRows.length, hoursLines.length);
    const rowHeight = Math.max(42, rowLineCount * 12 + 12);
    ensureSpace(rowHeight + 1);

    drawTableRowShell(cursorY, rowHeight, rowIndex % 2 === 0 ? [255, 255, 255] : theme.rowAlt);
    let x = MARGIN_X;

    dateLines.forEach((line: string, index: number) =>
      addText(line, MARGIN_X + 8, cursorY + 9 + index * 12, { size: dateFontSize, font: "F2" }),
    );
    x += dateWidth;
    if (includeTime) {
      timeRows.forEach((row, index) => {
        const top = cursorY + 9 + index * 12;
        addText(`${row.label}:`, x + 8, top, { size: 9.2, font: "F2" });
        addText(row.value, x + 28, top, { size: 9.2, font: "F2" });
      });
      x += timeWidth;
    }
    if (includeDuration) {
      hoursLines.forEach((line: string, index: number) => {
        const lineWidth = Math.max(line.length, 1) * 5.2;
        addText(line, x + (hoursWidth - lineWidth) / 2, cursorY + 9 + index * 12, { size: 10, font: "F2" });
      });
      x += hoursWidth;
    }
    taskLines.forEach((line: string, index: number) =>
      addText(line, x + 8, cursorY + 9 + index * 12, {
        size: line.startsWith("Remarks:") ? 9.2 : 10,
        font: line.startsWith("Remarks:") ? "F1" : "F2",
        color: line.startsWith("Remarks:") ? theme.secondary : theme.primary,
      }),
    );

    cursorY += rowHeight;
  });

  const signatureEntries = [
    normalizeText(userName) || normalizeText(userTitle)
      ? { name: userName || "", title: userTitle || "" }
      : null,
    normalizeText(secondaryName) || normalizeText(secondaryTitle)
      ? { name: secondaryName || "", title: secondaryTitle || "" }
      : null,
  ].filter(Boolean) as Array<{ name: string; title: string }>;

  onProgress?.(60, "Adding signatures...");
  cursorY += 22;

  const drawSignatureBlock = (x: number, blockWidth: number, name: string, title: string) => {
    const boxTop = cursorY;
    addLine(x + 20, boxTop + 40, x + blockWidth - 20, boxTop + 40, theme.primary, 1.2);
    addCenteredText((normalizeText(name) || "-").toUpperCase(), x, boxTop + 48, blockWidth, { size: 10.6, font: "F2" });
    addCenteredText(normalizeText(title) || "-", x, boxTop + 63, blockWidth, { size: 9.2, font: "F1", color: theme.secondary });
  };

  if (signatureEntries.length > 0) {
    ensureSpace(88);
    if (signatureEntries.length === 1) {
      const singleWidth = Math.min(280, contentWidth);
      const singleX = MARGIN_X + (contentWidth - singleWidth) / 2;
      drawSignatureBlock(singleX, singleWidth, signatureEntries[0].name, signatureEntries[0].title);
    } else {
      const sigGap = 28;
      const preferredColWidth = 220;
      const sigColWidth = Math.min(preferredColWidth, (contentWidth - sigGap) / 2);
      const totalSigWidth = sigColWidth * 2 + sigGap;
      const startX = MARGIN_X + (contentWidth - totalSigWidth) / 2;
      drawSignatureBlock(startX, sigColWidth, signatureEntries[0].name, signatureEntries[0].title);
      drawSignatureBlock(
        startX + sigColWidth + sigGap,
        sigColWidth,
        signatureEntries[1].name,
        signatureEntries[1].title,
      );
    }
    cursorY += 88;
  }

  const docEntries = processedData
    .map((day) => ({
      date: day.appendixDate || normalizeText(day.plainDate || day.date),
      images: (day.summary || []).flatMap((task: any) => task.images || []),
    }))
    .filter((entry) => entry.images.length > 0);

  onProgress?.(75, "Embedding documentation images...");
  if (docEntries.length > 0) {
    const docCardGap = 12;
    const gridGap = 12;
    const gridWidth = (contentWidth - gridGap - 24) / 2;
    const gridHeight = gridWidth * 0.75;
    const openAppendixPage = () => {
      currentPage = createPage();
      cursorY = TOP_MARGIN + HEADER_HEIGHT + 8;
      addText("DOCUMENTATION APPENDIX", MARGIN_X, cursorY, { size: 13, font: "F2" });
      cursorY += 20;
    };

    openAppendixPage();

    const ensureAppendixSpace = (height: number) => {
      if (cursorY + height > size.height - BOTTOM_MARGIN - FOOTER_HEIGHT) {
        openAppendixPage();
      }
    };

    for (const entry of docEntries) {
      const sets = chunkItems(entry.images, 4);
      for (const set of sets) {
        const images = set as LoadedImage[];
        const rows = chunkItems(images, 2);
        const cardHeight = 34 + rows.length * gridHeight + Math.max(0, rows.length - 1) * gridGap + 16;

        ensureAppendixSpace(cardHeight);
        const cardTop = cursorY;
        addRect(MARGIN_X, cardTop, contentWidth, cardHeight, [255, 255, 255], theme.border);
        addRect(MARGIN_X, cardTop, contentWidth, 26, theme.headerBg, theme.border);
        addText(entry.date, MARGIN_X + 12, cardTop + 9, { size: 10.5, font: "F2", color: theme.primary });

        const gridTop = cardTop + 34;
        rows.forEach((rowImages, rowIndex) => {
          const rowCount = rowImages.length;
          rowImages.forEach((image, colIndex) => {
            const left =
              rowCount === 1
                ? MARGIN_X + (contentWidth - gridWidth) / 2
                : MARGIN_X + 12 + colIndex * (gridWidth + gridGap);
            const top = gridTop + rowIndex * (gridHeight + gridGap);

            addRect(left, top, gridWidth, gridHeight, theme.headerBg, theme.border);

            const fit = Math.min(gridWidth / image.width, gridHeight / image.height);
            const drawWidth = image.width * fit;
            const drawHeight = image.height * fit;
            const drawX = left + (gridWidth - drawWidth) / 2;
            const drawY = size.height - top - gridHeight + (gridHeight - drawHeight) / 2;
            currentPage.ops.push(`q ${drawWidth} 0 0 ${drawHeight} ${drawX} ${drawY} cm /${imageRegistryNames.get(image.key)} Do Q`);
            currentPage.imageKeys.add(image.key);
          });
        });

        cursorY += cardHeight + docCardGap;
      }
    }
  }

  onProgress?.(92, "Finalizing PDF...");
  const pdfBytes = renderPdf({
    paperSize,
    pages,
    images: loadedImages,
  });

  const filePath = `${FileSystem.cacheDirectory}report_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(filePath, encodeBase64(pdfBytes.buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(filePath);
  const fileSize = info.exists && "size" in info ? info.size || 0 : 0;
  if (!info.exists || !fileSize || fileSize < 1500) {
    throw new Error(`Generated report file is empty. Last PDF size: ${fileSize} bytes.`);
  }

  onProgress?.(100, "Report ready");
  return filePath;
};
