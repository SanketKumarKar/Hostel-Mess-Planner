# Hostel Mess Planner & Menu Selection API

A modern, highly-scalable platform for educational institutions and hostels to manage large-scale dining logistics, student menu preferences, caterer sourcing, and continuous feedback loops.

![Platform Overview](https://img.shields.io/badge/Status-Production%20Ready-success)
![React](https://img.shields.io/badge/Client-React.js-blue)
![Backend](https://img.shields.io/badge/Server-Node.js/Express-green)
![Database](https://img.shields.io/badge/Database-Supabase-emerald)

---

## ✨ Core Features Designed for Enterprise Usage

### 📊 Multi-Role Architecture
Secure login through Supabase Auth (Email/Password + Google OAuth), dividing responsibilities with granular permission controls:
- **Admin Dashboard**: Create menu planning sessions, approve menu items, manage caterers, and finalize community menus with **auto-pre-selection of top-voted items**.
- **Caterer (Vendors) Dashboard**: Submit menu plans (Breakfast, Lunch, Snacks, Dinner) using configurable **1-week or 2-week menu cycles**, target specific mess types (Veg, Non-Veg, Special, Food Park), and send targeted announcements to users.
- **Student (End Users) Dashboard**: Flexibly select their designated caterer and mess types. Real-time voting on proposed menus (limited to **8 items per day**) and direct feedback submission keeps the community engaged.

### 📅 Advanced Menu Logistics
- **Configurable Cycle Length**: Each session can now be created as **1-week (Mon-Sun)** or **2-week (Mon Wk1-Sun Wk2)**. This controls manual slot selection, CSV scheduling windows, and PDF labels.
- **Slot-Based Labeling (Date-Independent)**: Day labels (e.g., Mon, Wk1 / Tue, Wk2) are now tied to menu slots, not session start/end dates, so planning labels remain stable and consistent.
- **AI-Powered Menu Suggestion**: Integration with Google Gemini AI allows caterers to input available raw materials (e.g., "potatoes, paneer, spinach") and receive 5 optimized bulk dish suggestions tailored for specific meal types and mess categories.
- **AI Bulk CSV Upload & Scheduling**: Admins can upload CSV files with `Breakfast`, `Lunch`, `Snacks`, and `Dinner` columns, auto-split comma-separated dish lists, and schedule them across **7 or 14 days** based on the selected session cycle.
- **Dual Distribution Modes**: Choose between **Equal Distribution** (round-robin by day) or **Minimum Per Day Configuration** (day-first allocation using configurable meal counts such as Breakfast 3, Lunch 6, Snacks 2, Dinner 6).
- **Resilient Scheduling Fallback**: If the AI distribution endpoint is unavailable, the frontend automatically uses local deterministic scheduling logic so bulk uploads still complete.
- **Admin Bulk Actions**: In Admin Menu Editor, quickly **Delete All Items**, **Remove Upload**, and use custom-styled confirmations for destructive actions.
- **Voting Interface**: A gamified selection system to gauge item popularity before final procurement approvals. Students can vote for up to **8 items per day**, enforced on both client and server.
- **Smart Admin Pre-selection**: When finalizing menus, items with the highest votes are automatically pre-selected per meal slot — admins can then review and override as needed.
- **Finalize Modal Productivity**: Added **Select All / Unselect All** controls during finalization for faster mass selection adjustments.
- **Branded PDF Reports**: One-click PDF generation producing clean, commercial-grade Excel-style tabular layouts for print menus, now featuring the **university logo** and professional header design.

### 🔐 Authentication & Security
- **Google OAuth**: One-click sign-in with Google, with automatic profile setup for first-time users.
- **Email Confirmation**: Traditional email/password registrations require email verification before access is granted.
- **Profile Onboarding Modal**: First-time Google users are guided through a mandatory setup flow to select their registration number, mess type, and caterer.

### 🧠 AI-Powered Operations
- **Feedback Analysis**: Features deep AI integration to automatically summarize hundreds of student feedback strings into consumable executive reports for admins and caterers. This turns raw sentiment into actionable insights, identifying patterns in food quality, timing, and specific dish feedback.
- **Admin Feedback Oversight**: Clicking **Pending Feedbacks** in the Admin dashboard now opens a modal with caterer-wise pending response counts, making follow-ups quicker.
- **Compact Vote Metrics**: Vote totals in admin views are now compactly formatted (for example, `1000 -> 1k`, `2500 -> 2.5k`) for easier scanning.

### 📢 Targeted Announcements System
- Caterers can broadcast real-time announcements directly to the dashboard of students assigned to their specific mess type, ensuring updates like "Lunch delayed by 15 mins" reach the right audience instantly.

---

## 🏗️ Technical Stack

### **Frontend Application**
- **Framework**: React.js powered by Vite for instant hot-module-reloading and minimal bundle sizes.
- **Language**: Fully typed using TypeScript for robust commercial scalability and self-documenting code.
- **Styling**: Tailwind CSS for rapid responsive design, ensuring mobile-first compatibility, and Lucide React for consistent vector iconography.
- **Routing**: React Router DOM (v6) handling protected private routing based on user session roles.

### **Backend Architecture & APIs**
- **Runtime & Web Framework**: Node.js & Express.js.
- **Database & Identity**: Supabase (PostgreSQL) handling robust relational queries, User Authentication, and Row Level Security (RLS) to enforce data silos between caterers.
- **Document Generation**: PDFKit enabling dynamic, buffer-streamed PDF exports directly to the browser.
- **Cross-Origin Resource Sharing**: CORS middleware implemented to ensure secure client-server handshake.

### **Integrations**
- Direct LLM integration for AI summarization via `axios`.

---

## 🗄️ Core Database Schema (Supabase)

At the heart of the application is a deeply relational Postgres Schema:
- **`profiles`**: Tied to Auth.users. Stores `full_name`, `role` (admin/student/caterer), and user-specific states (`mess_type`, `assigned_caterer_id`).
- **`voting_sessions`**: Defines the temporal bounds of a menu planning phase (`start_date`, `end_date`, `session_weeks`, `status` [draft, open_for_voting, finalized]).
- **`menu_items`**: Proposed dishes. Linked to `session_id`. Contains `meal_type` (e.g. breakfast) and `approval_status`.
- **`votes`**: Junction table bridging `profiles` and `menu_items`, ensuring unique constraints (one vote per user/meal).
- **`feedbacks`**: Stores raw qualitative data from students linking to `caterer_id`.
- **`announcements`**: Broadcast messages containing structural targeting (`mess_type`, `caterer_id`).

---

## 📡 Dedicated API Documentation

While the application leverages direct client-side Supabase PostgREST queries for primary, real-time data manipulation, heavy/secure operations run on dedicated Express endpoints.

### 1. AI Menu Suggestions (Raw Material Input)
Suggests exactly 5 bulk dishes based on available ingredients and culinary constraints.

**Endpoint**: `POST /api/ai/suggest-dishes`

- **Body (JSON)**:
  ```json
  {
      "ingredients": ["potatoes", "onions", "paneer"],
      "mealType": "lunch",
      "messType": "veg"
  }
  ```
- **Response (JSON)**:
  ```json
  {
      "dishes": [
          {"name": "Paneer Do Pyaza", "description": "A rich curry with paneer and double the onions."},
          {"name": "Aloo Jeera", "description": "Simple cumin-tempered potatoes, perfect for bulk serving."},
          ...
      ]
  }
  ```

### 2. Generate Finalized PDF Menu
Creates a downloadable, print-friendly grid (Excel-style) converting the 14-day schedule. 

**Endpoint**: `GET /api/generate-pdf/:sessionId/:messType`

- **Params**:
  - `sessionId` (String): The UUID corresponding to the active `voting_sessions`.
  - `messType` (String): The categorization Enum (`veg`, `non_veg`, `special`, `food_park`).
- **Response**: Buffer Stream `application/pdf`. Forces download on the client side via Content-Disposition headers.

### 3. AI Feedback Summarization
Consolidates raw student feedback into an intelligent executive summary.

**Endpoint**: `POST /api/ai/summarize-feedback`

- **Body (JSON)**:
  ```json
  {
      "feedbackText": "The dal was a bit salty, but I really enjoyed the paneer. Quality has been improving."
  }
  ```

### 4. AI/Deterministic CSV Distribution
Distributes uploaded CSV menu items over a configurable session window (7 or 14 days) with selectable scheduling strategy.

**Endpoint**: `POST /api/ai/distribute-csv`

- **Body (JSON)**:
  ```json
  {
    "items": [
      { "name": "Idli", "meal_type": "breakfast", "description": "Bulk Upload" },
      { "name": "Rice", "meal_type": "lunch", "description": "Bulk Upload" }
    ],
    "days": 7,
    "distributionMode": "min-config",
    "mealCounts": {
      "breakfast": 3,
      "lunch": 6,
      "snacks": 2,
      "dinner": 6
    }
  }
  ```

- **Modes**:
  - `equal`: Round-robin distribution by day for each meal type.
  - `min-config`: Fills one full day at a time in meal order (`breakfast -> lunch -> snacks -> dinner`) based on `mealCounts`, then moves to the next day.

- **Response (JSON)**:
  ```json
  {
    "distributed": [
      { "name": "Idli", "meal_type": "breakfast", "description": "Bulk Upload", "day_index": 0 },
      { "name": "Rice", "meal_type": "lunch", "description": "Bulk Upload", "day_index": 0 }
    ]
  }
  ```
- **Response (JSON)**:
  ```json
  {
      "summary": "### Executive AI Summary\n\n- **Quality Patterns**: Minor seasoning improvements suggested for Dal.\n- **Positives**: Strong positive reception on Paneer options.\n- **Overall Sentiment**: Generally Positive with minor actionable tweaks."
  }
  ```

---

## 🚀 Deployment & Getting Started

To launch the project on your local machine for further development:

1. **Clone & Install Dependencies**:
   \`\`\`bash
   # Install backend dependencies
   cd server
   npm install

   # Install frontend components
   cd ../client
   npm install
   \`\`\`

2. **Environment Configuration**:
   - In `/server`, copy `.env.example` to `.env`. Ensure your `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and AI Provider keys are mapped.
   - In `/client`, create `.env.local` containing:
     \`\`\`env
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_ANON_KEY=your_public_anon_key
     VITE_API_URL=http://localhost:5000/api
     \`\`\`

3. **Start the Development Servers**:
   - Backend: Run `nodemon index.js` (or `npm start`) in the `/server` directory to boot the Express API on port 5000.
   - Frontend: Run `npm run dev` in the `/client` directory to start the Vite HMR server on port 5173.

---

> *This platform is built entirely with extensibility in mind. Its modular role-based design makes it highly functional for massive university campuses, scaled corporate cafeterias, and decentralized food distribution services looking to tighten the feedback loop between consumption and supply.*
