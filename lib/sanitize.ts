// Shared validation + sanitization for all user input

export const LIMITS = {
  boardTitle:   { min: 1,  max: 80  },
  boardDesc:    { min: 0,  max: 300 },
  boardPrompt:  { min: 0,  max: 200 },
  noteContent:  { min: 1,  max: 500 },
  authorName:   { min: 0,  max: 60  },
};

/** Strip HTML tags and trim whitespace */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")   // strip any HTML tags
    .replace(/javascript:/gi, "") // kill JS URIs
    .trim();
}

export function validateBoardTitle(title: string): string | null {
  const v = sanitizeText(title);
  if (v.length < LIMITS.boardTitle.min) return "Title is required";
  if (v.length > LIMITS.boardTitle.max) return `Title must be ${LIMITS.boardTitle.max} characters or less`;
  return null;
}

export function validateNoteContent(content: string): string | null {
  const v = sanitizeText(content);
  if (v.length < LIMITS.noteContent.min) return "Note cannot be empty";
  if (v.length > LIMITS.noteContent.max) return `Note must be ${LIMITS.noteContent.max} characters or less`;
  return null;
}

export function validateAuthorName(name: string): string | null {
  const v = sanitizeText(name);
  if (v.length > LIMITS.authorName.max) return `Name must be ${LIMITS.authorName.max} characters or less`;
  return null;
}
