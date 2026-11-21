# Project context
MERN journal app. Express + Mongoose + MongoDB backend in server/, React (Vite,
plain JavaScript, no TypeScript) frontend in client/, bcrypt + JWT auth.
Entry fields are encrypted per field with AES-256-GCM (each field has its own
iv and authTag). The date is stored in plaintext. The AES key is derived from
the user's password and a per-user salt at login and held only in server memory,
indexed by session id. Never store it in the JWT or on disk.

# Target design
One continuous page, like MS Word with the navigation pane. One entry per day,
keyed by date, all days stacked in one scrolling page (oldest at top, newest at
bottom). Each day starts with its date as an H3-style heading, then the body in
a borderless auto-growing textarea. No cards, boxes or dividers. Title and
excerpt are optional and hidden in the UI. A left sidebar lists dates grouped by
year > month. No forgot-password flow.

# Rules
- Do not change encryption, key handling or auth logic unless strictly
  necessary. If it seems necessary, stop and tell me why first.
- Plain JavaScript. Do not add dependencies without asking.
- Do not break existing entries (they have title/excerpt and must still decrypt).
- Small, reviewable changes. No unrelated refactors.
- Before coding, list in 3-5 lines the files you will change. Then implement.
- After implementing, tell me what to click or type to verify it works.