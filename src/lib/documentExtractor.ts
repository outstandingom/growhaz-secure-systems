// Browser-side document text extraction + content hashing + Merkle tree.
// Unified pipeline for both Hindi and English:
//   extract text -> normalizeForMerkle() -> tokenize -> chunk(100 tokens) -> chunk hashes -> Merkle root
// The same document always produces the same Merkle root.
// Uses Tesseract.js for OCR, pdfjs-dist for PDFs, mammoth for DOCX.
//
// NOTE ON DETERMINISM: Digital/searchable documents will produce perfectly stable
// Merkle roots. Scanned documents requiring OCR use a highly constrained pipeline,
// but OCR engines cannot absolutely guarantee 100% identical outputs across all
// environments and hardware configurations.

import { createWorker, type Worker } from "tesseract.js";
import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

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

// ---------- Persistent OCR workers (one per language) ----------
const workers: Record<string, Promise<Worker>> = {};
async function getWorker(lang: "eng" | "hin+eng" = "eng"): Promise<Worker> {
  if (!workers[lang]) {
    workers[lang] = createWorker(lang).catch((err) => {
      delete workers[lang];
      throw err;
    });
  }
  return workers[lang];
}

// ---------- Helpers ----------
export function cleanTextEng(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[@©•]/g, "")
    .replace(/[^\w\s:/@.-]/g, " ")
    .trim();
}

export function cleanTextHin(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\u0900-\u097F\w\s.,:/()\-]/g, " ")
    .trim();
}

// Back-compat exports used elsewhere
export const cleanText = cleanTextEng;

/**
 * Universal normalization for Merkle tree input.
 * Produces deterministic output from the same logical content regardless of:
 * - Minor OCR whitespace/punctuation variations
 * - Hindi vs English text
 * - Unicode encoding differences (NFC normalized)
 */
export function normalizeForMerkle(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\u0900-\u097F\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Map the old hash normalizer to the unified Merkle one
export const normalizeForHash = normalizeForMerkle;

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasDevanagari(text: string): boolean {
  const matches = text.match(/[\u0900-\u097F]/g);
  return !!matches && matches.length >= 10;
}

export function detectDocumentType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("transaction") || t.includes("utr") || t.includes("debited")) return "financial_document";
  if (t.includes("aadhaar") || t.includes("government of india") || t.includes("आधार")) return "identity_document";
  if (t.includes("invoice") || t.includes("gst") || t.includes("चालान")) return "invoice";
  if (t.includes("degree") || t.includes("diploma") || t.includes("university") || t.includes("विश्वविद्यालय")) return "certificate";
  if (t.includes("registry") || t.includes("रजिस्ट्री") || t.includes("पंजीकरण")) return "land_registry";
  return "unknown";
}

// ---------- Tokenize + chunk + merkle ----------
export function tokenize(text: string): string[] {
  return text.split(" ").filter(Boolean);
}

export function chunkTokens(tokens: string[], size = 100): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += size) chunks.push(tokens.slice(i, i + size).join(" "));
  return chunks;
}

export async function buildMerkleTree(leafTexts: string[]): Promise<{
  root: string;
  leaves: { index: number; hash: string }[];
  levels: string[][];
} | null> {
  if (!leafTexts.length) return null;
  const leafHashes = await Promise.all(leafTexts.map((t) => sha256Hex(t)));
  const leaves = leafHashes.map((h, i) => ({ index: i, hash: h }));
  let current = [...leafHashes];
  const levels: string[][] = [current];
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] || left;
      next.push(await sha256Hex(left + right));
    }
    levels.push(next);
    current = next;
  }
  return { root: current[0], leaves, levels };
}

// ---------- Format-specific extractors ----------

// OCR Mutex Lock to process images sequentially and strictly avoid Tesseract race conditions.
let ocrMutex = Promise.resolve<{ text: string; confidence: number }>({ text: "", confidence: 0 });

async function ocrImage(file: File | Blob, lang: "eng" | "hin+eng" = "eng"): Promise<{ text: string; confidence: number }> {
  const task = async () => {
    const worker = await getWorker(lang);
    const url = URL.createObjectURL(file);
    try {
      const { data } = await worker.recognize(url, {
        tessedit_pageseg_mode: 6, // Numeric page segment mode
        preserve_interword_spaces: "1",
      });
      return { text: data.text || "", confidence: data.confidence ?? 0 };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const result = ocrMutex.then(task, task);
  ocrMutex = result.catch(() => ({ text: "", confidence: 0 }));
  return result;
}

async function renderPdfPageToBlob(page: pdfjs.PDFPageProxy, scale = 2): Promise<Blob> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  
  // Enforce solid white background to avoid transparent PDF rendering issues
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  
  // Output lossless PNG to prevent JPEG compression artifacts from confusing OCR
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png")!);
}

/**
 * Extract a PDF page-by-page. Tries text layer first; if a page has no text,
 * falls back to OCR for that single page.
 */
async function extractPdfPages(file: File, lang: "eng" | "hin+eng"): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  const maxPages = pdf.numPages; // Ensure entire document is represented
  
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let pageText = content.items
      .map((it: any) => it.str)
      .join(" ")
      .replace(/\s+/g, " ") // Normalize internal PDF spacing
      .trim();
      
    if (pageText.length < 20) {
      const blob = await renderPdfPageToBlob(page, 2);
      const { text } = await ocrImage(blob, lang);
      pageText = text;
    }
    pages.push(pageText);
  }
  return pages;
}

async function extractFromDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || "";
}

async function extractFromText(file: File): Promise<string> {
  return await file.text();
}

// ---------- High-level API ----------
export interface ExtractedDoc {
  rawText: string;
  cleanedText: string;
  normalizedText: string;
  contentHash: string;
  documentType: string;
  language: "hin" | "eng";
  merkleRoot: string;
  leafHashes: { index: number; hash: string }[];
  totalChunks: number;
  totalTokens: number;
  pages?: { pageNumber: number; text: string; hash: string }[];
  ocrConfidence?: number;
}

export async function extractAndHash(file: File): Promise<ExtractedDoc> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();

  let rawText = "";
  let pageTexts: string[] | null = null;
  let ocrConfidence: number | undefined;

  if (ext === "pdf" || mime === "application/pdf") {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let sample = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      sample += " " + content.items.map((it: any) => it.str).join(" ");
    }
    const langGuess: "eng" | "hin+eng" = hasDevanagari(sample) ? "hin+eng" : "eng";
    pageTexts = await extractPdfPages(file, langGuess);
    rawText = pageTexts.join(" ");
  } else if (ext === "docx" || mime.includes("officedocument.wordprocessingml")) {
    rawText = await extractFromDocx(file);
  } else if (IMAGE_EXT.has(ext) || mime.startsWith("image/")) {
    // Note: Two-pass OCR optimizes speed. For maximum determinism across heavily 
    // mixed-language environments, you could bypass this and always run "hin+eng".
    const first = await ocrImage(file, "eng");
    rawText = first.text;
    ocrConfidence = first.confidence;
    if (hasDevanagari(rawText) || rawText.trim().length < 5) {
      const second = await ocrImage(file, "hin+eng");
      rawText = second.text || rawText;
      ocrConfidence = second.confidence;
    }
    pageTexts = [rawText];
  } else if (TEXT_EXT.has(ext) || mime.startsWith("text/")) {
    rawText = await extractFromText(file);
  } else {
    try { rawText = await extractFromText(file); } catch { /* Ignore */ }
    if (!rawText.trim()) {
      const r = await ocrImage(file, "eng");
      rawText = r.text;
      ocrConfidence = r.confidence;
    }
  }

  if (!rawText || rawText.trim().length < 2) {
    throw new Error("No readable text found in the uploaded file");
  }

  const language: "hin" | "eng" = hasDevanagari(rawText) ? "hin" : "eng";
  
  // Cleaned text is still formatted based on language for downstream UI/readability
  const cleaned = language === "hin" ? cleanTextHin(rawText) : cleanTextEng(rawText);
  
  // Unify normalization so contentHash and merkleRoot evaluate the exact same string
  const merkleNormalized = normalizeForMerkle(rawText);
  const contentHash = await sha256Hex(merkleNormalized);

  const tokens = tokenize(merkleNormalized);
  const totalTokens = tokens.length;
  const chunks = chunkTokens(tokens, 100);
  const totalChunks = chunks.length;
  const merkle = await buildMerkleTree(chunks);

  let pages: { pageNumber: number; text: string; hash: string }[] | undefined;
  if (pageTexts && pageTexts.length > 1) {
    pages = await Promise.all(
      pageTexts.map(async (t, i) => ({
        pageNumber: i + 1,
        text: t,
        hash: await sha256Hex(normalizeForMerkle(t)),
      })),
    );
  }

  return {
    rawText,
    cleanedText: cleaned,
    normalizedText: merkleNormalized,
    contentHash,
    documentType: detectDocumentType(cleaned),
    language,
    merkleRoot: merkle?.root || contentHash,
    leafHashes: merkle?.leaves || [],
    totalChunks,
    totalTokens,
    pages,
    ocrConfidence,
  };
}

export async function extractDocumentText(file: File): Promise<string> {
  const r = await extractAndHash(file);
  return r.rawText;
         }
