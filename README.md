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
| `npm run check` | Both: every type error and lint problem in the project |

**In VS Code**, open the repo root (`code .`) and install the ESLint extension when it's suggested. Type errors and lint problems then show as you edit, for every file, not just open ones, in the Problems panel (⇧⌘M) and as red underlines. **Terminal → Run Build Task** (⇧⌘B) runs the full check across every package and lists the results there too. The settings are in `.vscode/`.

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

**What's in the app** (the same as the website, from the same API and board server):
- **Tabs:** **Animals** (where everyone lands: every animal with its photo and story, search, dogs/cats and stage filters, follow, like, adopt or sponsor), **Board** (one stage at a time, for moving animals along, with an **Updates** button on each card), **Following**, **Donate** (bank and PayPal details with copy buttons; they live in `packages/shared/src/donation.ts`, shared with the website) and **Alerts**.
- **An animal's screen** switches between **Details** (facts, photos, stage, like, adopt/sponsor, follow, and **Edit details** for staff) and **Updates** (the box to post one, with **Speak it**, and every update so far). A notification about a new update opens Updates.
- **Staff:** a **Register** button on Animals and Board opens the form (camera or photo library, uploaded as JPEG; "Rather say it?" fills it in by voice). Coordinators can delete from **Edit details**.
- **Coordinators:** the megaphone opens **Social media post** (Claude draft, copy caption, photo, the phone's share menu); the people icon opens **Members** to review sign-ups; an offer notification opens who it's from, their email and the animal.
- **Joining:** "New here? Create an account" on the sign-in screen (`/api/auth/join`), as a member like on the website.
- **Speech** uses `expo-audio` (recorded as M4A and sent to `/api/transcribe`), photos `expo-image-picker`, sharing `expo-sharing` and `expo-file-system`, copying `expo-clipboard`. After pulling, run `npm install`.

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
- **Coordinators review new members** on the **Settings** page (`/settings`, coordinators only; anyone else is sent to the Animals page). Click your name in the top bar (an icon on phones) for **Profile**, **Settings** and **Sign out**; a badge there shows how many people are waiting. A coordinator picks a role (coordinator, vet, fosterer or sponsor) and the line shown under their name, then clicks **Make staff**, or **Keep as member** to clear them from the list. If the person is on the board at that moment, the edit controls appear straight away with a message saying they're now staff.
- New sign-ups are added to the running board server the first time they connect, and coordinators' lists update live. Emails are only ever sent to coordinators.
- The roles are in `packages/shared/src/protocol.ts` (`STAFF_ROLES`, `isStaff`), and the database change is `packages/db/migrations/002_members.sql`.

### Profile

**Profile** (`/profile`, from the menu under your name) is for everyone signed in: change your name and the line shown under it, and your password.

- **Name and line** are saved through the board server (`profile.update`), so everyone's copy updates at once. Left empty, the line becomes your role ("Vet") or "Member".
- **Password:** your current one, then the new one (at least 10 characters), checked in a server action (`apps/web/app/profile/actions.ts`). The demo accounts keep the demo password while the demo sign-in buttons are shown, so others can still try them.

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

### Speaking an update

Staff can say an update instead of typing it: **Speak it** under "Post an update" (open an animal's **Updates** on the board) records from the microphone, then [ElevenLabs Scribe](https://elevenlabs.io/docs/api-reference/speech-to-text/convert) turns it into text and adds it to the box, after anything already typed, to check and edit before posting. English, Arabic or a mix are detected automatically, and filler words ("um", "er") are left out.

- Up to 3 minutes per recording. The browser records WebM (Chrome, Android) or MP4 (Safari, iPhone) and sends it to `/api/transcribe` (staff only), which passes it to ElevenLabs. The key stays on the server.
- The recording isn't stored here; ElevenLabs processes it under its own terms.
- Turned on by `ELEVENLABS_API_KEY` (and optionally `ELEVENLABS_STT_MODEL`, default `scribe_v2`). Without a key, the button doesn't show.
- The code is in `apps/web/components/DictateButton.tsx` and `apps/web/lib/transcribe.ts`.

### Registering by voice

At the top of **Register an animal** (new animals only), **Rather say it?** → **Speak it**: say the name, dog or cat, girl or boy, roughly how old, where they were found, whether they're neutered and anything else. ElevenLabs writes it down, then Claude sorts it into the form's fields (`apps/web/lib/animalFromSpeech.ts`: Claude replies with JSON in the form's shape, which is checked field by field). Only what was said is filled in; anything not mentioned stays blank, never guessed. The area is matched to the known areas' spelling. Other details go into Notes. "You said: …" shows the transcript, and everything stays editable before **Register**.

- Needs `ELEVENLABS_API_KEY` (or the block doesn't show) and `ANTHROPIC_API_KEY`. Without the Anthropic key, what was said goes into Notes as it is.
- `/api/animals/from-speech` is staff only, like registering.

### The animal panel

On the board each card has two buttons, and each opens its own panel: **Details** (facts, photos, stage, followers and, for staff, offers to help) and **Updates** (the form to post one, and every update so far). Clicking the card itself opens Details, and each panel has a link to the other. A notification about a new update opens the Updates panel.

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

### Shelter layout (staff)

`/shelter` (**Shelter** in the menu, and a shortcut on the home page for staff on phones) is a rough plan of each place the animals stay, with each animal dragged to where it is. Staff see and change every layout.

**Visitors and members** see the layouts staff switched to **Show to visitors** (the main shelter; foster homes stay private), read-only, as **Who's where**: the plan, a search, and a list of who's in each area, each name linking to the animal's page. Visitors get there from **Visit** in the top bar or "Coming to visit? See who's where" on the home page; members from **Shelter** in the menu. Visitors see the layout as it was when the page loaded. `GET /api/shelter` gives everyone who isn't staff only the public layouts, and only the animals at the shelter; changes are staff only (403).

- **Layouts:** one per place (the shelter, a foster home…). **Start from an example** gives a row of kennels, quarantine, a cat room, a vet room and the yard to adjust, or start with a blank plan.
- **Areas:** **Draw an area**, then drag out each one on the plan (Esc or **Done drawing** to stop; **Add area** waits until you have), or **Add area** to drop one in a free spot. Drag an area by its name to move it (the animals inside move with it), and drag its corner to resize it. Click its name to rename or delete it; deleting an area leaves its animals where they are.
- **Animals:** everyone at the vet, recovering or ready for adoption. Those not on any plan are listed under **Not placed**: drag one onto the plan, or click it and pick an area. Click an animal on the plan to move it to another area, take it off the plan, or open its panel; dragging it back onto the list takes it off too. An animal is only ever in one place. Animals still on the street or adopted don't show (their spot is kept if they come back).
- **Staff on duty:** at the shelter, press **I'm here** (in the top bar next to your name, or under **On duty today** on the main shelter's layout) so visitors know who to ask. It's only for the main shelter: the first layout shown to visitors. Staff aren't drawn on the plan; everyone, visitors included, sees a list of who's on duty (name and role, e.g. "Dr Karim, Vet"). A check-in lasts until **I've left** or the end of the day, Egypt time (`shelter_staff`, `006_shelter_staff.sql`).
- **Without dragging:** everything works from the menus, and with the keyboard: arrow keys nudge an animal or an area (Shift for bigger steps), arrow keys on an area's corner resize it, and Delete takes an animal off the plan.
- **Saving:** each change shows straight away and is saved in order through `POST /api/shelter` (one change at a time, checked with the zod schema in `packages/shared/src/shelter.ts`); the answer replaces the page's copy, so it settles on what's saved. Changes other staff make appear when the tab comes back into view, and every 20 seconds.
- **Positions are percentages** of the plan (which keeps a 3:2 shape), so it looks the same on any screen; on phones the plan scrolls sideways.

The code is in `apps/web/components/screens/shelter/ShelterPlan.tsx` (staff), `ShelterMap.tsx` (read-only), `apps/web/lib/useShelter.ts`, `apps/web/app/api/shelter/route.ts` and `packages/db/src/shelter.ts`.

### Social post (coordinators)

`/social` (**Social post** in the menu, coordinators only; everyone else is sent back to the board and the API answers 403) writes a post with Claude and shares it to LinkedIn and a Facebook Page. It's the LinkedIn post studio, moved in.

1. **What it's about:** pick an animal (optional: its facts, last few updates and page link go to Claude), say what the post is about, and choose a tone (heartfelt, a story, an appeal for help, good news, or updates: the animal's latest updates, up to 3, or with no animal picked, the 3 latest updates across the rescue).
2. **Your post:** Claude's draft, which you can edit freely (LinkedIn allows 3,000 characters), or copy.
3. **Share it:** **Copy caption**, add a photo if you like (one of the animal's, or one from your device; it's turned into a JPEG of at most 2048px in the browser), then **Post** opens the phone's share menu: with the photo if there is one, otherwise with the text. Pick Instagram, Facebook (a personal profile or the Page), WhatsApp and so on, and paste the caption there: Instagram and Facebook throw away text sent by other apps. On a computer without a share menu, the photo is saved instead. Once LinkedIn or Facebook keys are set up, those can also be posted to straight from here, text and photo together (Facebook posts go to a Page you manage); until then they're hidden, and **Setting up** at the bottom of the page explains what's needed.

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
| `shelter_layouts`, `shelter_areas`, `shelter_placements`, `shelter_staff` | shelter plans (and whether visitors can see each one), their labelled areas, where each animal is (one row per animal), and who's checked in today and where (`004`–`006`) |

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
