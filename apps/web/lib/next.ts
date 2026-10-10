/**
 * Where to go after signing in or joining, from ?next=. Only paths on this
 * site ("/animals/…"), never another site ("//evil.example", "https://…").
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
