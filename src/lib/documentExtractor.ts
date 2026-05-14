// Browser-side document text extraction + content hashing.
// Mirrors the Node.js reference: cleanText -> normalizeForHash -> SHA-256.
// Uses Tesseract.js for images, pdfjs-dist for PDFs (text layer first, OCR
// fallback for scanned PDFs), mammoth for DOCX, plain read for TXT-like files.
// NO Gemini / Vision API is used here — keeps cost at zero.

import { createWorker, type Worker } from "tesseract.js";
import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

// Configure pdfjs worker (Vite-friendly: use CDN matching version)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const IMAGE_EXT = new Set([
  "jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif",
  "gif", "avif", "heic", "heif", "jfif", "ico",
]);

const TEXT_EXT = new Set([
  "txt", "csv", "json", "xml", "html", "htm", "md", "rtf", "log",
  "ini", "cfg", "yaml", "yml", "toml", "env", "sql",
  "js", "ts", "py", "java", "c", "cpp", "h", "css", "scss",
  "sh", "bat", "ps1", "rb", "php", "go", "rs", "swift", "kt",
]);

// ---------- Persistent OCR worker (lazy, reused across calls) ----------
let ocrWorker: Worker | null = null;
let ocrInit: Promise<Worker> | null = null;

async function getOCRWorker(): Promise<Worker> {
  if (ocrWorker) return ocrWorker;
  if (!ocrInit) {
    ocrInit = createWorker("eng").then((w) => {
      ocrWorker = w;
      return w;
    });
  }
  return ocrInit;
}

// ---------- Helpers (1:1 with Node.js reference) ----------
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[@©•]/g, "")
    .replace(/[^\w\s:/@.-]/g, " ")
    .trim();
}

export function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "").replace(/[^\w]/g, "");
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function detectDocumentType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("transaction") || t.includes("utr") || t.includes("debited")) return "financial_document";
  if (t.includes("aadhaar") || t.includes("government of india")) return "identity_document";
  if (t.includes("invoice") || t.includes("gst")) return "invoice";
  if (t.includes("degree") || t.includes("bachelor") || t.includes("master") || t.includes("diploma") || t.includes("university")) return "certificate";
  return "unknown";
}

// ---------- Format-specific extractors ----------
async function extractFromImage(file: File | Blob): Promise<string> {
  const worker = await getOCRWorker();
  const url = URL.createObjectURL(file);
  try {
    const { data } = await worker.recognize(url);
    return data.text || "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractFromPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  // Step 1: try the embedded text layer (free, instant)
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str).join(" ");
    text += " " + pageText;
  }

  if (text.trim().length > 20) return text;

  // Step 2: scanned PDF — render each page to canvas + Tesseract OCR
  // Limit to first 3 pages for speed (matches Node.js reference)
  const maxPages = Math.min(pdf.numPages, 3);
  let ocrText = "";
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92)!);
    ocrText += " " + (await extractFromImage(blob));
  }
  return ocrText;
}

async function extractFromDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || "";
}

async function extractFromText(file: File): Promise<string> {
  return await file.text();
}

// ---------- Main router ----------
export async function extractDocumentText(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (ext === "pdf" || mime === "application/pdf") return extractFromPdf(file);
  if (ext === "docx" || mime.includes("officedocument.wordprocessingml")) return extractFromDocx(file);
  if (IMAGE_EXT.has(ext) || mime.startsWith("image/")) return extractFromImage(file);
  if (TEXT_EXT.has(ext) || mime.startsWith("text/")) return extractFromText(file);

  // Unknown — try as text first, then image OCR
  try {
    const t = await extractFromText(file);
    if (t.trim().length > 0) return t;
  } catch { /* ignore */ }
  return extractFromImage(file);
}

// ---------- High-level API: extract + clean + hash ----------
export interface ExtractedDoc {
  rawText: string;
  cleanedText: string;
  normalizedText: string;
  contentHash: string;
  documentType: string;
}

export async function extractAndHash(file: File): Promise<ExtractedDoc> {
  const raw = await extractDocumentText(file);
  const cleaned = cleanText(raw);
  if (!cleaned || cleaned.length < 2) {
    throw new Error("No readable text found in the uploaded file");
  }
  const normalized = normalizeForHash(cleaned);
  const contentHash = await sha256Hex(normalized);
  return {
    rawText: raw,
    cleanedText: cleaned,
    normalizedText: normalized,
    contentHash,
    documentType: detectDocumentType(cleaned),
  };
}
