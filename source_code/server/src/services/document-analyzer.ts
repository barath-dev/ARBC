export interface OcrProvider {
    extractText(fileBuffer: Buffer, mimeType: string): Promise<string>;
    extractConfidenceScores?(): Promise<number>;
}

export interface DocumentAnalysisResult {
    extractedText: string;
    authenticityScore: number;
    flags: string[];
}

/**
 * Tesseract.js Adapter (STUBBED)
 * Follows the adapter pattern so it can be swapped for Google Cloud Vision,
 * Mindee, or Klippa without refactoring the orchestrator.
 */
export class TesseractAdapter implements OcrProvider {
    public async extractText(_fileBuffer: Buffer, _mimeType: string): Promise<string> {
        console.log("[STUB] Tesseract.js extracting text locally...");
        await new Promise((resolve) => setTimeout(resolve, 800));
        return "Sample extracted text containing keywords like React, Node.js, and TypeScript.";
    }
}

export class DocumentAnalyzerService {
    constructor(private readonly ocrProvider: OcrProvider = new TesseractAdapter()) { }

    public async analyzeDocument(
        _fileBuffer: Buffer,
        _mimeType: string,
        _documentType: string
    ): Promise<DocumentAnalysisResult> {

        // 1. Extract text using the injected OCR provider (Tesseract.js default)
        const text = await this.ocrProvider.extractText(_fileBuffer, _mimeType);

        // 2. Perform STUBBED forgery detection
        // In a real system, this would check EXIF metadata, PDF fonts, and signature stamps
        const flags: string[] = [];
        let score = 0.95;

        if (text.includes("Photoshop")) {
            flags.push("Metadata indicates image manipulation software used.");
            score -= 0.4;
        }

        return {
            extractedText: text,
            authenticityScore: score,
            flags,
        };
    }
}

export const documentAnalyzer = new DocumentAnalyzerService();
