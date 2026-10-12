/**
 * CORS for the phone app's web preview (`npm run web -w @safe-paws/mobile`, on Expo's dev
 * server). Native apps don't need it. Only these origins, and only with a Bearer token:
 * no cookies are allowed across, so another site can't act as a signed-in person.
 */
const appWebOrigins = new Set((process.env.APP_WEB_ORIGINS ?? "http://localhost:8081").split(",").map((o) => o.trim()));

export function appCors(req: Request, methods: string): Record<string, string> {
  const origin = req.headers.get("origin");
  return origin && appWebOrigins.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": methods,
        Vary: "Origin",
      }
    : {};
}
