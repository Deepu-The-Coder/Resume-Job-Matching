import { PDFParse } from 'pdf-parse';

/**
 * Parse raw PDF buffer and return extracted text.
 * Throws a descriptive error for unreadable or empty PDFs.
 *
 * @param {Buffer} buffer - Raw PDF file buffer
 * @param {string} originalFilename - Original filename (for error messages)
 * @returns {Promise<string>} Extracted plain text
 */
export async function parsePdf(buffer, originalFilename = 'file.pdf') {
  let result;
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    result = await parser.getText();
  } catch (err) {
    throw Object.assign(
      new Error(`Failed to parse PDF "${originalFilename}": ${err.message}`),
      { statusCode: 422, code: 'PDF_PARSE_ERROR' }
    );
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }

  const text = result?.text?.trim() ?? '';

  if (!text || text.length < 20) {
    throw Object.assign(
      new Error(
        `PDF "${originalFilename}" appears to be empty or unreadable (extracted ${text.length} characters). ` +
          'Please upload a text-based PDF, not a scanned image.'
      ),
      { statusCode: 422, code: 'PDF_EMPTY' }
    );
  }

  return text;
}

export default { parsePdf };
