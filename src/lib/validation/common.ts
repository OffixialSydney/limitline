import { z } from "zod";

export const moneyString = (label: string) =>
  z.string().trim().regex(/^-?\d+(\.\d{1,2})?$/, `${label} must be a number with up to 2 decimals`);
export const positiveMoney = (label: string) =>
  moneyString(label).refine((v) => Number(v) > 0, `${label} must be greater than zero`);
export const priceString = (label: string) =>
  z.string().trim().regex(/^\d+(\.\d{1,8})?$/, `${label} must be a positive number`)
    .refine((v) => Number(v) > 0, `${label} must be greater than zero`);

/** Optional text field: empty string becomes undefined. */
export const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters`).optional().transform((v) => (v ? v : undefined));
/** Optional field validated by `schema`: empty string or missing becomes undefined. */
export const optionalOf = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([z.literal(""), schema]).optional().transform((v) => (v === "" || v === undefined ? undefined : (v as z.infer<T>)));

export const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, for example USD");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const uuid = z.string().uuid("Invalid identifier");

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function flattenZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
