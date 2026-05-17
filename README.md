# 🏛️ National E-Voting System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase-emerald.svg)](https://supabase.com/)
[![Hosting: Vercel](https://img.shields.io/badge/Hosting-Vercel-black.svg)](https://vercel.com/)

An advanced, end-to-end secure, full-stack electronic voting system designed to replicate real-world democratic mechanisms. It combines absolute cryptographic transparency with robust voter privacy guarantees.

---

## 🚀 Key Features

*   **🔒 Ballot Anonymity Guarantee:** Utilizes a highly decoupled database structure—there are no foreign keys or links between "who voted" and "what they voted," guaranteeing absolute anonymity.
*   **⛓️ Cryptographic Hash Chain:** Votes are secured using an AES-256-GCM encrypted ballot connected in a blockchain-style SHA-256 hash chain, ensuring any ballot tampering is instantly detected and auditable.
*   **🌍 Smart Voter Eligibility:** Enforces district and state-level voter eligibility. Voters can only cast ballots in their registered constituencies, with read-only exploration access to other states.
*   **🔔 Real-Time Notifications & Badging:** Glowing status badges ("Results Out", "Active") and real-time badging inside the Admin Panel to alert administrators of pending voter sign-up reviews.
*   **📊 Sleek Results Dashboard:** Beautiful, reactive data visualizations mapping election results, winner statistics, and absolute transparency audit logs.
*   **📱 Fully Responsive:** Carefully tailored layout optimizations for mobile viewports, including horizontally-scrolling data tables and floating smooth-scrolling modals.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime Environment** | Node.js + Express 5 | API Routing, server middleware, controller flows |
| **Database** | Supabase (PostgreSQL) | Dynamic persistence with active Row-Level Security (RLS) |
| **Database Client** | `@supabase/supabase-js` v2 | High-performance, secure backend database client |
| **Frontend Layout** | HTML5 + CSS3 + Vanilla JavaScript | Premium modern design system without heavy framework overhead |
| **Cryptography** | Node.js Built-in `crypto` | AES-256-GCM ballot encryption, SHA-256 hash-chaining |
| **Email Services** | `nodemailer` | Safe OTP verification codes delivery via SMTP |
| **Security Headers** | `helmet` + `cors` | Rigid HTTP headers security and cross-origin resource protection |
| **Rate Limiting** | `express-rate-limit` | Shields the authentication routes from brute force attacks |
| **Session Control** | `cookie-parser` | Secure httpOnly session tokens storage in client cookies |

---

## ⚙️ Installation & Local Setup

### 1. Prerequisites
*   [Node.js](https://nodejs.org/) (v18.0.0 or higher)
*   A [Supabase](https://supabase.com/) account and project.

### 2. Clone the Repository
```bash
git clone https://github.com/yash1746/E-voting-system-.git
cd E-voting-system-
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
1. Open the **SQL Editor** in your Supabase Dashboard.
2. Copy and run the schema setup code from `supabase/schema.sql` to initialize all tables, relations, constraints, and RLS policies.
3. Run the SQL seeding code from `supabase/seed.sql` to populate default eligible voter cards, parties, and demo elections.
4. Run the following command in the SQL Editor to add the controlled release column:
   ```sql
   ALTER TABLE elections ADD COLUMN IF NOT EXISTS results_announced boolean DEFAULT false;
   ```

### 5. Environment Configuration
Create a `.env` file in the root of the project and populate it with your credentials:
```env
# Supabase Configuration
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# JWT & OTP Secrets
JWT_SECRET=your-secure-jwt-key
OTP_EXPIRY_MINUTES=10

# Server
PORT=3000
NODE_ENV=development

# Email (for OTP Delivery)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@evoting.gov.in
```

### 6. Run the Application
Start the development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the application.

---

## 🔒 Security Summary

This platform is engineered to prevent all standard electronic voting attack vectors:
*   **Double Voting Prevention:** The unique database constraint `unique(eligible_voter_id, election_id)` in the `vote_receipts` table guarantees that a voter can never cast more than one ballot in a single election.
*   **Brute-Force Shielding:** Rate-limiting policies block spam and credential stuffing on critical API endpoints.
*   **Session Hijacking Defense:** Session keys are transmitted exclusively inside **httpOnly, Secure** cookies, preventing access by malicious client-side JavaScript.
*   **Vote Privacy:** Since "who voted" and "what they voted" are stored in separate, unlinked tables, it is mathematically impossible to link a cast ballot back to a voter's identity.

---

## 📂 Project Directory Structure

```
E-voting-system/
│
├── server.js                 ← Express entry point
├── package.json              ← Node.js dependencies and scripts
├── .env                      ← Local environment configurations (ignored)
├── .gitignore                ← Local files to ignore
├── vercel.json               ← Vercel deployment directives
│
├── config/
│   └── supabase.js           ← Supabase service-role client client initialization
│
├── middleware/
│   └── auth.js               ← Secure requireAuth and requireAdmin controllers
│
├── utils/
│   ├── crypto.js             ← AES-256 GCM ballot encryptors & SHA-256 hash chains
│   └── mailer.js             ← SMTP government-styled email loaders
│
├── routes/
│   ├── authRoutes.js         ← 3-step OTP auth and logout controls
│   ├── electionRoutes.js     ← Election CRUD, activation, and explicit release APIs
│   ├── voteRoutes.js         ← Secure anonymous voting mechanisms
│   ├── resultsRoutes.js      ← Verified tallies and public hash chain audit routes
│   ├── partyRoutes.js        ← Political party, actions, and speeches CRUD
│   ├── adminRoutes.js        ← Admin voter management and audit logging APIs
│   └── registrationRoutes.js ← Voter registration requests and reviews
│
└── public/                   ← Pure Vanilla web portal layouts
    ├── css/style.css         ← Glassmorphic Dark UI stylesheets
    ├── js/                   ← SPA frontend controllers (admin, dashboard, vote, results, etc.)
    └── index.html            ← Landing and entry portal
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
