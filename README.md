# Safe Paws

A live rescue board for a street-animal rescue. Each animal moves through stages: Reported → At the vet → Recovering → Ready for adoption → Adopted. Everyone sees changes instantly, and the people who need to know get a notification written for them.

| When Dr Karim moves Luna to *Ready for adoption* | They see |
| --- | --- |
| Kaori, who sponsors Luna | "Luna, who you sponsor, has finished treatment and is ready for adoption." |
| Mona, the coordinator | "Luna is ready for an adoption listing." |
| Dr Karim, who made the change | nothing |

A monorepo with a Next.js web app (Material UI, React Hook Form, zod), a React Native (Expo) app and a Node WebSocket server, sharing one typed package. Everything is stored in Postgres.

## Run it

```bash
npm install          # once, at the repo root: installs every workspace
npm run db:up        # Postgres 17 in Docker on :5432 (skip if you have your own, see below)
npm run dev          # creates the tables and sample data if needed, then web on :3000 and board server on :8788
npm run dev:mobile   # the Expo app (in a second terminal)
```

- **Web:** open http://localhost:3000 and sign in with a demo account (password `rescue-demo`). Sign in as someone else in a private window, put the two side by side, and move Luna.
- **Phone:** with `npm run dev:mobile` running, scan the QR code with Expo Go (iOS or Android, same Wi-Fi as your computer). The app finds the web app and board server on your computer automatically. Press `w` in that terminal to open the app in a browser instead.
- **Both at once:** sign in as Kaori on the phone and as Dr Karim on the web, then move Luna on the web. Kaori's phone shows her own message straight away.

| Script (run at the root) | What it does |
| --- | --- |
| `npm run dev` | Web app and board server together |
| `npm run dev:web` / `dev:server` / `dev:mobile` | One of them on its own |
| `npm run db:up` / `db:down` | Start or stop the Postgres container (data is kept in a Docker volume) |
| `npm run db:migrate` | Apply any new files in `packages/db/migrations/` |
| `npm run db:seed` | Add the sample people and animals, only if the database is empty |
| `npm run db:reset` | Delete everything and start again with the sample data (refused in production) |
| `npm run smoke` | In its own `safepaws_smoke` database: checks every kind of handshake (cookie, app token, forged, foreign site), then registers, moves, notes and edits as four people and prints what each received |
| `npm run typecheck` / `lint` | Across every workspace |

Copy `.env.example` to `.env.local` at the root to set `DATABASE_URL`, and set `SESSION_SECRET` before deploying. In development a fixed fallback secret is used, so it works out of the box.

## Layout

```
apps/web/          Next.js 16 + Material UI: login, board (desktop + phone layouts), /api/auth/token
apps/mobile/       Expo + expo-router: login, Board / Following / Alerts tabs, animal screen
server/            WebSocket server: board state, notification rules, push delivery
packages/db/       @safe-paws/db — Postgres pool, SQL migrations, sample data, queries
packages/shared/   @safe-paws/shared — protocol types, sample data, session signing,
                   form schemas (zod), the Zustand store and stage helpers
```

npm workspaces link `@safe-paws/shared` into each app, so a change to a message type is type-checked in the web app, the mobile app and the server at once. The shared package ships TypeScript source: Next compiles it via `transpilePackages`, Metro and `tsx` read it directly.

## How it works

```
web (Next.js)                             board server (server/)
─────────────                             ──────────────────────
/login ── server action ── sets signed cookie
/board ── WebSocket + cookie ──────────▶  verify Origin + session → identity
app (Expo)                                       ▲
POST /api/auth/token → token in secure storage   │
WebSocket + bearer token ────────────────────────┘
   ▲      animal.move / note / follow ─▶  apply to state (state.ts)
   │                                       │
   │  board.patch (everyone)         ◀─────┤  who needs to know? (notify.ts)
   │  notification (just you)        ◀─────┘  save, then push to that person's sockets
                                           └──▶ Expo push, if their app isn't open
```

### Live updates and notifications

- **`server/src/notify.ts`** decides who hears about a change and what each person is told. It's pure functions, so the rules are easy to read and test: followers get a follower message, the role responsible for the new stage gets an action message, the actor gets nothing, and nobody gets two.
- **`server/src/state.ts`** writes every change and notification to Postgres before telling anyone, so people who are offline find their notifications when they come back, and nothing is lost on a restart.
- **`server/src/index.ts`** keeps a map of person → open sockets, so someone with two tabs or a phone and a laptop gets the notification everywhere, and reading it in one place clears the badge in the others.
- Every connect and reconnect gets a full snapshot, so a dropped connection can't leave a stale board or a missed notification. Board changes go out as versioned patches; the client ignores anything older than what it has.

### Signing in

- `/login` checks the email and password with a server action. Passwords are stored as scrypt hashes and compared in constant time; an unknown email still runs a hash, so response time doesn't reveal who has an account, and the error message is the same either way.
- A successful sign-in sets an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) holding a signed session: `payload.HMAC(payload)`. No session store is needed, because anything holding `SESSION_SECRET` can verify it (`packages/shared/src/session.ts`).
- `proxy.ts` (Next 16's name for middleware) redirects signed-out visitors to `/login`. That's only an optimistic check; the board page verifies the session itself.
- **The board server trusts the cookie, not the page.** The browser sends the cookie with the WebSocket handshake (cookies ignore ports, so `:3000` and `:8788` share it). The server verifies it before accepting the connection and takes the person's identity from it.
- It also checks the handshake's `Origin`. Browsers attach cookies to WebSocket handshakes from any website, so without this another site could open a socket as you (cross-site WebSocket hijacking). Allowed origins come from `BOARD_ALLOWED_ORIGINS`.
- A connection is closed when its session expires (close code 4401) and the page goes back to `/login`. If a reconnect is refused, the page asks `/api/session` whether you're still signed in, so "signed out" and "server down" are handled differently.

### The mobile app

- **Signing in** goes to `POST /api/auth/token`, which runs the same password check as the web login but returns the signed session in the body instead of a cookie. The app keeps it in the phone's secure storage (Keychain on iOS, Keystore on Android) via `expo-secure-store`.
- **Connecting** sends the token as a WebSocket subprotocol (`bearer.<token>`). The server verifies it before accepting, exactly as it verifies the web cookie. Cookies suit browsers and bearer tokens suit apps; there's no Origin check for tokens, because a web page can't attach one to a socket (that's the cross-site risk the cookie path guards against).
- **Push notifications:** after connecting, the app registers its Expo push token. When the server creates a notification for someone whose app has no open connection, it sends it through Expo's push service; tapping it opens that animal. A notification arriving while the app is open shows as an in-app banner instead.
- **Coming back to the app** reconnects immediately (phones suspend sockets in the background), and the snapshot on connect catches up on anything missed.
- **Shared code:** the app uses the same Zustand store, protocol types, stage rules and time formatting as the web app, all from `@safe-paws/shared`. Only the screens are platform-specific.

**Turning on push** needs two one-off steps, because Expo Go can't receive remote push and push tokens are tied to an Expo project:

```bash
cd apps/mobile
npx eas-cli@latest init              # log in to (or create) a free Expo account; adds the project id to app.json
```

Then put a development build on your phone:

- **iPhone:** `npx expo run:ios --device` builds with Xcode and installs on a connected iPhone (needs Xcode and a free Apple ID added in Xcode → Settings → Accounts). Cloud builds for iPhone need a paid Apple Developer account.
- **Android:** `npx eas-cli@latest build --profile development --platform android` builds an APK in Expo's cloud for free; install it from the link it prints.

Until then everything else works in Expo Go, and the app skips push quietly.

### Joining: members and staff

- **Anyone can sign up** at `/register` (linked from the sign-in page) with their name, email, a password (10+ characters) and, optionally, how they help. They're signed straight in as a **member**.
- **Members can look, not change.** They see every animal, its photos and updates, and can follow animals to get notifications. They don't see the Register button, drag handles, stage picker, "Edit details" or "Post update", and the board server refuses those changes from them anyway, checking their current role on every message.
- **Coordinators review new members.** A people icon in the header shows how many are waiting. In the Members window, a coordinator picks a role (coordinator, vet, fosterer or sponsor) and the line shown under their name, then clicks **Make staff**, or **Keep as member** to clear them from the list. If the person is on the board at that moment, the edit controls appear straight away with a message saying they're now staff.
- New sign-ups are added to the running board server the first time they connect, and coordinators' lists update live. Emails are only ever sent to coordinators.
- The roles are in `packages/shared/src/protocol.ts` (`STAFF_ROLES`, `isStaff`), and the database change is `packages/db/migrations/002_members.sql`.

### Home page

`/` is a public page anyone can see without signing in: "Helping abandoned Dogs of Egypt", the donation message, and two buttons. **Donate** goes to `/donate`, a public page with the bank transfer and PayPal details (edit them in `apps/web/lib/donation.ts`). **Meet our animals** goes to the Animals page.

### The Animals page

`/animals` (the **Animals** link in the header) lists every animal with its details for everyone signed in, members and staff alike. It's read-only: nothing here changes an animal's record. Search by name or area, and filter by stage or dogs and cats.

**Visitors who aren't signed in** can see the Animals page and each animal's page too, read-only and without live updates (a snapshot when the page loads, from `apps/web/lib/publicBoard.ts`). They see the photos, the facts and how many people follow and like each animal, but never who: followers and likes are counts, and offers to help are left out. Updates are for members only: visitors see a prompt to join instead, and the updates are left out of what the page sends. There's no **Follow** button; **Adopt or sponsor** and **Like** open a popup asking them to create an account or sign in, which then brings them straight back to that animal (`?next=`, only ever a path on this site). Photos and videos on an animal's profile are served to visitors; files still sitting in someone's unsaved form stay private.

- **Click any card** (or its name, with the keyboard) to open that animal's page at `/animals/<id>`: every photo and video, the facts, where it is on the way from street to home, followers and likes, and all updates. The same buttons are there too.
- Each card shows its first photo (at most 200px tall) and how many updates there are; the updates open in a popup.
- **Follow** works as on the board: you get notified about that animal.
- **Like** (the heart) is a simple count, updated live for everyone.
- **Adopt or sponsor:** adopting is offered once an animal is *Ready for adoption*; sponsoring until it has a home. The person can add a message (up to 500 characters). Every coordinator is notified ("Aya would like to adopt Zeina: …"), the person starts following the animal, and the offer shows for staff under **Offers to help**, a section that starts closed (on the animal's page and in its panel on the board). Each person can offer once of each kind per animal.
- Members only see their own offers; offers are stored in `animal_requests` and likes in `animal_likes` (`packages/db/migrations/003_likes_and_requests.sql`).

### Registering an animal

**Register an animal** (top bar on desktop, the round button on phones) opens a form for name, species, sex, age (a number and weeks/months/years, with an "estimate" tick), neutered (yes / no / not sure), weight (optional), where they were found, notes, and photos and videos. **Edit details** in any animal's panel opens the same form pre-filled.

- **Photos and videos upload as soon as they're picked**, with a progress bar each, so saving is instant. Save waits if anything is still uploading.
- **Uploads are checked three times:** by type (allowlist; no SVG, since it can carry script), by size (15 MB photos, 100 MB videos), and by the file's first bytes, so a renamed web page can't pass as a photo. The same limits run in the browser first for a quick answer.
- **Media is private:** `/api/media/<id>` serves files only to signed-in people (web cookie or the app's Bearer token), with `nosniff`, and supports byte ranges so videos can seek (Safari needs this to play at all). Where the files live depends on where the site runs, all handled in `apps/web/lib/media.ts`; their details (type, size, who uploaded them) are in Postgres either way.
  - **On Vercel: a private Vercel Blob store.** Vercel's servers can't keep files, and only accept requests up to 4.5 MB, so the browser uploads each file straight to Blob with a short-lived token from `/api/media/upload` (staff only, one allowed type and size, a fresh `media/<uuid>` path). Then `/api/media/register` checks what actually arrived (type, size, first bytes) before recording it, and deletes anything that fails. Turned on when you connect a Blob store to the project: newer stores sign in with Vercel's short-lived OIDC credentials (`BLOB_STORE_ID`), older ones with a fixed `BLOB_READ_WRITE_TOKEN`; both work. `GET /api/media/upload` (signed in as staff) reports which one the site found.
  - **Locally: `apps/web/.uploads/`**, through `/api/media`, so development needs no setup. The phone app uses this route too (up to 4.5 MB per file on Vercel).
- **The server validates the details with the same zod schema** as the form, gives the new animal an id the browser chose (so it can open straight away), puts it at the top of *Reported*, and makes the person who registered it a follower.
- **Notifications:** coordinators hear about every new animal and the vet is told it may need a check. New photos or videos notify followers ("Mona added 1 new photo of Luna, who you sponsor."); small corrections don't.
- The mobile app shows the new details and the photos (sending its token to load them). Registering from the app is a good next step.

### Social post (coordinators)

`/social` (**Social post** in the menu, coordinators only; everyone else is sent back to the board and the API answers 403) writes a post with Claude and shares it to LinkedIn and a Facebook Page. It's the LinkedIn post studio, moved in.

1. **What it's about:** pick an animal (optional: its facts, last few updates and page link go to Claude), say what the post is about, and choose a tone (heartfelt, a story, an appeal for help, good news). Add a photo: one of the animal's, or one from your device. Photos are turned into a JPEG of at most 2048px in the browser, so they fit Vercel's 4.5 MB request limit and every network accepts them.
2. **Your post:** Claude's draft, which you can edit freely (LinkedIn allows 3,000 characters), or copy.
3. **Share it:** **Share** opens the phone's share menu with the photo, for Instagram, a personal Facebook profile, Stories, WhatsApp and so on, and copies the post to paste as the caption (Instagram ignores text that comes with a photo). On a computer without a share menu it copies the post and saves the photo instead. Or connect LinkedIn and/or Facebook once and post straight from here; Facebook posts go to a Page you manage.

How it's kept safe:
- The keys live only in environment variables on the server and are never sent to the browser.
- Each coordinator signs in to LinkedIn or Facebook themselves. The sign-in is kept in an encrypted, httpOnly cookie that only `/api/social` can read, tied to that coordinator's account, so it's useless to anyone else. **Disconnect** deletes it.
- The draft and photo are kept in the tab while you're away signing in, so nothing is lost.

Setup (each part is optional; the page shows what's missing, with the exact redirect URLs to copy):
- **Claude:** `ANTHROPIC_API_KEY` from console.anthropic.com. `ANTHROPIC_MODEL` is optional.
- **LinkedIn:** create an app at linkedin.com/developers, add the products *Share on LinkedIn* and *Sign In with LinkedIn using OpenID Connect*, add the redirect URL `https://<your site>/api/social/linkedin/callback`, then set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.
- **Facebook:** create an app at developers.facebook.com with *Facebook Login*, add the redirect URL `https://<your site>/api/social/facebook/callback`, ask for `pages_show_list`, `pages_manage_posts` and `pages_read_engagement`, then set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`. Until the app is approved by Meta, only people with a role on the app can connect.
- Add them in Vercel (Settings, Environment Variables) and redeploy. `SESSION_SECRET` must be set, since it also encrypts the sign-in cookies.

The code is in `apps/web/lib/social/`, `apps/web/app/api/social/` and `apps/web/components/SocialStudio.tsx`.

### Data (Postgres)

**Getting a database.** Any one of these works; `npm run dev` creates the tables and sample data on first run.

- **Docker:** `npm run db:up`. Nothing else to set: the default `DATABASE_URL` points at it.
- **Postgres.app or Homebrew** (`brew install postgresql@17`): create a user and database, then put the URL in `.env.local`:
  `createuser -s safepaws && createdb -O safepaws safepaws` → `DATABASE_URL=postgres://safepaws@localhost:5432/safepaws`
- **Hosted (Neon, Supabase, Railway…):** paste their connection string into `DATABASE_URL`, usually ending `?sslmode=require`.

`npm run smoke` creates a second database next to yours (`<name>_smoke`), so the user needs permission to create databases; your own data is never touched.

**Tables** (`packages/db/migrations/001_initial.sql`):

| Table | Holds |
| --- | --- |
| `users` | name, role (staff role or `member`), email, scrypt password hash, when and by whom they were reviewed |
| `animals` | details (species, sex, age, neutered, weight, where found, notes), stage and position in the column |
| `notes` | updates posted on an animal |
| `animal_followers` | who follows which animal |
| `uploads`, `animal_media` | each photo or video, and which animal shows it, in order |
| `animal_likes`, `animal_requests` | likes, and offers to adopt or sponsor with the person's message |
| `notifications` | one row per person per message, with a read flag |
| `push_tokens` | each phone's Expo push token |

**How the server uses it.** The board server reads the whole board into memory when it starts (a rescue has hundreds of animals, not millions), then for each change: write it to Postgres in one transaction, and only if that succeeds update memory and tell everyone. Changes are applied one at a time, so two people dragging at once can't interleave. The database checks the rules too (stage names, sex, positive weight, real uploads), and a refused change comes back to the person as a plain message rather than a crash.

**Migrations** are numbered `.sql` files, each applied once in a transaction and recorded in `schema_migrations`. They run when you start `npm run dev`, `npm start` or the board server, and a lock stops two servers migrating at once. To change the schema, add `002_….sql`; never edit one that has already run.

### Forms and design (web)

- **Material UI 9** for every component, with one theme (`apps/web/lib/theme.ts`): plum for actions, mint for soft highlights. Light and dark follow the system setting through MUI's CSS variables, so there's no flash of the wrong theme. `AppRouterCacheProvider` collects styles during server rendering.
- **React Hook Form + zod** for the sign-in form and the "Post an update" form. The schemas live in `packages/shared/src/schemas.ts` and are used three times: by the form (instant field errors), by the login server action, and by the app's token endpoint. The server never trusts that the browser already checked.
- The mobile app uses the same mint-and-plum palette with React Native components.

### Desktop and phone (web)

- **Desktop:** a five-column board. Drag and drop is dnd-kit, with mouse, touch and keyboard support plus screen-reader announcements.
- **Phone (under 720px):** one stage at a time, with stage tabs, full-width cards and a one-tap button for the next step ("Send to the vet", "Mark ready for adoption"), a full-screen animal sheet, and a bottom bar for Board, Following (a feed of the animals you follow) and Alerts. Each role opens where they're most needed: the vet on *At the vet*, fosterers on *Recovering*, sponsors on *Following*.

## Next steps

- [ ] Find out from the rescue how they really work: stages, roles, what goes wrong today
- [ ] Daily Postgres backups (and the Blob store) before the rescue relies on it
- [ ] Rate-limit sign-ups and sign-ins, and confirm email addresses
- [ ] Sign up from the mobile app (for now the app's members sign up on the website)
- [ ] Let coordinators change or remove staff roles, not just grant them
- [ ] A coordinator's list of open adopt and sponsor offers, with a "done" button
- [ ] The Animals page in the mobile app
- [ ] Register animals and take photos from the mobile app (expo-image-picker)
- [ ] Delete uploads that were removed from the form before saving
- [ ] Queue changes made on a weak connection and retry them
- [ ] Sign-in by emailed or WhatsApp link, which suits volunteers better than passwords
- [ ] Tests for `notify.ts` and the store, and a Playwright run of the two-person flow
- [ ] Push receipts (Expo reports delivery a little later) and a per-person setting to mute push

The stages, people and animals are sample data until the rescue confirms how they actually work.
