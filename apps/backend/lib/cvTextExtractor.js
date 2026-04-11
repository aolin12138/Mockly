import pdfParse from 'pdf-parse';

const MAX_CV_TEXT_LENGTH = 20_000;

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const truncate = (value, maxLength) => {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const decodeBase64 = (content) => {
  if (!content || typeof content !== 'string') return null;
  try {
    return Buffer.from(content, 'base64');
  } catch {
    return null;
  }
};

export const extractCvText = async (cvFile) => {
  if (!cvFile || typeof cvFile !== 'object') return null;

  const mimeType = (cvFile.type || '').toLowerCase();
  const fileName = (cvFile.name || '').toLowerCase();
  const fileBuffer = decodeBase64(cvFile.content);

  if (!fileBuffer) return null;

  const isPdf = mimeType.includes('pdf') || fileName.endsWith('.pdf');
  if (!isPdf) {
    return null;
  }

  const parsed = await pdfParse(fileBuffer);
  const normalized = normalizeWhitespace(parsed?.text || '');
  if (!normalized) return null;

  return truncate(normalized, MAX_CV_TEXT_LENGTH);
};
