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
- **Caterer (Vendors) Dashboard**: Submit comprehensive 14-day menu plans (Breakfast, Lunch, Snacks, Dinner), target specific mess types (Veg, Non-Veg, Special, Food Park), and send targeted announcements to users.
- **Student (End Users) Dashboard**: Flexibly select their designated caterer and mess types. Real-time voting on proposed menus (limited to **8 items per day**) and direct feedback submission keeps the community engaged.

### 📅 Advanced Menu Logistics
- **14-day Dynamic Cycles**: Automatically structures schedules down to "Week 1" and "Week 2" loops to manage cyclical variety without manual calendar hunting.
- **AI-Powered Menu Suggestion**: Integration with Google Gemini AI allows caterers to input available raw materials (e.g., "potatoes, paneer, spinach") and receive 5 optimized bulk dish suggestions tailored for specific meal types and mess categories.
- **Voting Interface**: A gamified selection system to gauge item popularity before final procurement approvals. Students can vote for up to **8 items per day**, enforced on both client and server.
- **Smart Admin Pre-selection**: When finalizing menus, items with the highest votes are automatically pre-selected per meal slot — admins can then review and override as needed.
- **Branded PDF Reports**: One-click PDF generation producing clean, commercial-grade Excel-style tabular layouts for print menus, now featuring the **university logo** and professional header design.

### 🔐 Authentication & Security
- **Google OAuth**: One-click sign-in with Google, with automatic profile setup for first-time users.
- **Email Confirmation**: Traditional email/password registrations require email verification before access is granted.
- **Profile Onboarding Modal**: First-time Google users are guided through a mandatory setup flow to select their registration number, mess type, and caterer.

### 🧠 AI-Powered Operations
- **Feedback Analysis**: Features deep AI integration to automatically summarize hundreds of student feedback strings into consumable executive reports for admins and caterers. This turns raw sentiment into actionable insights, identifying patterns in food quality, timing, and specific dish feedback.

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
- Direct LLM integration for AI Summerization via `axios`.

---

## 🗄️ Core Database Schema (Supabase)

At the heart of the application is a deeply relational Postgres Schema:
- **`profiles`**: Tied to Auth.users. Stores `full_name`, `role` (admin/student/caterer), and user-specific states (`mess_type`, `assigned_caterer_id`).
- **`voting_sessions`**: Defines the temporal bounds of a menu planning phase (`start_date`, `end_date`, `status` [draft, open_for_voting, finalized]).
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

**Endpoint**: `POST /api/summarize-feedback`

- **Body (JSON)**:
  ```json
  {
      "feedbackText": "The dal was a bit salty, but I really enjoyed the paneer. Quality has been improving."
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
