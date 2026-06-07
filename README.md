# Guestbook 📖✨

> A private record of moments, memories, and visits.

Guestbook is a privacy-focused digital visitor journal that allows authenticated visitors to record moments from their visit through photos/selfies, moods, and short messages. It is designed to combine robust authentication, secure storage, moderation workflows, and detailed audit logging into a fast, premium, and personal visitor engagement experience.

**Live Project URL**: [sagarthalavar.in/guestbook](https://sagarthalavar.in/guestbook)

---

## 🛠️ Technology Stack

- **Core Frontend**: HTML5 (Semantic Structure) & TypeScript (Vite-bundler)
- **Styling**: Modern Vanilla CSS (with HSL token systems, glassmorphism, responsive grid layout, and subtle micro-animations)
- **Backend & Auth**: Supabase (PostgreSQL Database, Google/Magic Link OAuth, Secure Storage buckets, Row Level Security)
- **Development Tooling**: Vite & TypeScript

---

## 📁 Folder Structure

The project directory is structured as follows:

```text
guestbook/
├── .github/
│   └── workflows/          # Future CI/CD build checks
├── supabase/
│   └── migrations/         # Supabase database SQL schema files
│       └── 20260607000000_init_schema.sql
├── src/
│   ├── assets/             # Brand SVGs, logos, icons
│   │   └── logo.svg        # Custom designed Guestbook logo
│   ├── css/
│   │   └── main.css        # Design system variables, glassmorphic styles, and global resets
│   ├── js/
│   │   ├── auth/           # [Upcoming] Authentication helper functions
│   │   ├── components/     # [Upcoming] Selfie camera component, forms
│   │   ├── db/             # [Upcoming] Supabase db client interface
│   │   └── admin/          # [Upcoming] Moderation panel routines
│   ├── main.ts             # App entry point & Supabase status validation
│   └── vite-env.d.ts       # TypeScript type definitions for Vite environment
├── index.html              # Core HTML file with SEO elements & Google Fonts
├── .env.example            # Template file for database environment variables
├── .env                    # Local environment variables (Git ignored)
├── .gitignore              # Files/folders excluded from source control
├── package.json            # Node configuration (scripts and dependencies)
├── tsconfig.json           # TypeScript compilation settings
├── vite.config.js          # Vite configuration options
└── README.md               # Master documentation (this file)
```

---

## 🚀 Setup & Local Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (version 18 or higher) and [Git](https://git-scm.com/) installed.

### 1. Clone & Navigate
If accessing the repository, navigate into the project root:
```bash
cd guestbook
```

### 2. Install Dependencies
Install all package dependencies including the Supabase JavaScript Client and Vite:
```bash
npm install
```

### 3. Configure Environment Variables
Create your local environment file:
```bash
cp .env.example .env
```
Open the `.env` file and replace the values with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Run Development Server
Start Vite's development hot-reloading server:
```bash
npm run dev
```
The application will open automatically at [http://localhost:3000](http://localhost:3000).

---

## 🗄️ Database Setup (Supabase)

To connect the application backend:

1. **Create a Supabase Project**: Create a new project in your [Supabase Dashboard](https://supabase.com/).
2. **Execute Migrations**:
   - Go to the **SQL Editor** tab in your Supabase dashboard.
   - Click **New Query**.
   - Copy and paste the contents of `supabase/migrations/20260607000000_init_schema.sql`.
   - Run the script to initialize tables (`profiles`, `guestbook_entries`, `audit_logs`), setup automated update triggers, database status triggers, and load Row Level Security (RLS) policies.
3. **Configure Storage Bucket**:
   - In the Supabase Dashboard, go to **Storage**.
   - Create a bucket named `selfies`.
   - Toggle **Restricted Bucket** (to ensure image urls are not publicly guessable and are retrieved securely by auth clients).
   - Write policies allowing:
     - Users to read/write their own objects in `selfies`.
     - Admins to read/delete all objects.

---

## 🎨 Branding & Theme Guidelines

- **Typography**: Headers use `Outfit` for a friendly, modern tech brand feel. Body copy uses `Inter` for clean legibility.
- **Visuals**: Dark mode by default, backed by a premium glassmorphic background layer (`backdrop-filter`) and border glows.
- **Color Codes**:
  - Indigo Primary (`#6366f1` / `hsl(243, 75%, 59%)`)
  - Violet Secondary (`#8b5cf6` / `hsl(258, 90%, 66%)`)
  - Pink Accent (`#ec4899` / `hsl(340, 82%, 59%)`)
  - Dark Slate background (`#0b0f19` / `hsl(222, 47%, 7%)`)

---

## 📅 Roadmap Overview
- **Phase 0: Foundation** (Current) — Repository initialization, core configuration, styling, branding, and schema definition.
- **Phase 1: Authentication** — Google Sign-in & Magic Link validation.
- **Phase 2: Visitor Dashboard** — Entry statuses (pending/approved/rejected) view.
- **Phase 3: Create Entry** — Memory submittal forms (Name, selfie, mood, 200-char message limit).
- **Phase 4: Submission Rules** — Dynamic rate-limiting checks (1/day, 3/week, 10/month, 50/lifetime).
- **Phase 5: Selfie Camera** — Interactive webcam frame and image preview widget.
- **Phase 6: Consent System** — Moderation agreement check boxes.
- **Phase 7: Moderation Workflow** — Status transition engines.
- **Phase 8: Admin Panel** — Operations dashboard for approval, rejection, and exports.
- **Phase 9: Rejection Rules** — Reupload rules and retry limits.
- **Phase 10: Email notifications** — Auto-email triggers for approval/rejection.
