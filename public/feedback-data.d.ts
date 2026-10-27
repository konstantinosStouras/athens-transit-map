export const MAX_IMAGES: number;
export const MAX_IMAGE_BYTES: number;
export const TOTAL_IMAGE_BUDGET: number;
export function validScreenshot(file: {type: string; size: number}): boolean;
export function feedbackDocument(input: {comment?: unknown; images?: unknown; name?: unknown; email?: unknown; url?: unknown}, ticket: string, createdAt: unknown): {text: string; images: string[]; name: string; email: string; uid: null; ticket: string; page: string; url: string; ua: string; forwarded: boolean; status: string; createdAt: unknown};
