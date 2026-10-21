# FeastFull — Hostel Mess Planner & Campus Dining Logistics API

A modern, highly-scalable platform for educational institutions and hostels to manage large-scale dining logistics, student menu voting, caterer sourcing, dietary nutrition tracking, room delivery for sick students, and continuous feedback loops.

![Platform Overview](https://img.shields.io/badge/Status-Production%20Ready-success)
![React](https://img.shields.io/badge/Client-React.js-blue)
![Backend](https://img.shields.io/badge/Server-Node.js/Express-green)
![Database](https://img.shields.io/badge/Database-Supabase-emerald)

---

## ✨ Core Features Designed for Enterprise Usage

### 📊 Multi-Role Architecture
Secure login through Supabase Auth (Email/Password + Google OAuth), dividing responsibilities with granular permission controls:
- **Admin Dashboard**: Create menu planning sessions, approve menu items, manage caterers, manage special room delivery requests, inspect live feedback, and finalize community menus with **auto-pre-selection of top-voted items**.
- **Caterer (Vendors) Dashboard**: Submit menu plans (Breakfast, Lunch, Snacks, Dinner) using configurable **1-week or 2-week menu cycles**, target specific mess types (Veg, Non-Veg, Special, Food Park), pack and fulfill assigned room delivery orders, and send targeted announcements.
- **Student (End Users) Dashboard**: Select designated caterers and mess types. Real-time voting on proposed menus with interactive daily limits, meal window check-in/out, live mess crowd meter, and room delivery requests for medical/illness needs.
- **Parent Portal**: Linked parent accounts can view student meal attendance, dining logs, and nutritional intake remotely.

---

### 🏥 Special Requests & Care Delivery (Medical Room Delivery)
- **Student Submission**: Students who are ill or injured can submit special room delivery requests for specific meals (`Breakfast`, `Lunch`, `Snacks`, `Dinner`), specifying their hostel block, room number, reason, and attaching medical prescriptions/proof images.
- **Admin Approval Tab**: Dedicated **Special Requests** tab on the Admin Dashboard with pending badge counters, multi-filtering (by status, block, meal type), keyword search, image proof previewer, and one-click **Approve** / **Reject** with custom admin notes.
- **Fulfillment Pipeline**: 6-stage lifecycle tracking: `Pending Review` ➔ `Approved` ➔ `Packed` ➔ `Out for Delivery` ➔ `Delivered` (or `Rejected`).
- **Caterer Integration**: Caterers view and update delivery requests exclusively for their assigned students.

---

### 🌙 Night Mess & Campus Ordering
- **Block-Specific Night Menus**: Hostel blocks (A, B, C, D, E) have targeted night mess menus with real-time availability toggling, item categorization, and transparent pricing.
- **Student Night Cart**: Students can browse available night food items, calculate totals, and place orders directly.
- **Admin & Caterer Control**: Admins and caterers can update item availability, upload new night dishes, and manage block inventories.

---

### 🥗 NutriPlan & Macro Tracking
- **Nutrition Metadata**: Menu items include caloric value (`kcal`) and protein content (`protein_grams`).
- **Interactive Nutrition Planner**: Students can plan daily meals based on personal health goals, track protein targets, and monitor daily caloric intake.

---

### 👥 Mess Crowd Status & Meal Attendance
- **Live Crowd Meter**: Monitors real-time mess occupancy (`Low`, `Moderate`, `High`, `Peak`) with expected queue waiting times to help students avoid peak rushes.
- **Meal Window Check-In / Check-Out**: Students check in during active meal windows (`Breakfast 07:30–10:00`, `Lunch 12:00–14:30`, `Snacks 16:30–18:00`, `Dinner 19:30–22:00`) with countdown timers for estimated dining completion.

---

### 📅 Advanced Menu Planning & Voting Logistics
- **Session Switcher**: Quick-switch dropdown on the Student Dashboard to view and vote across active voting periods, review upcoming drafts, or check finalized winning menus.
- **Configurable Cycle Length**: Sessions support **1-week (Mon-Sun)** or **2-week (Mon Wk1-Sun Wk2)** cycles with stable, slot-based day labeling.
- **AI-Powered Menu Suggestion**: Integration with Google Gemini AI allows caterers to input available raw materials and receive 5 optimized bulk dish suggestions tailored for specific meal types and mess categories.
- **AI Bulk CSV Upload & Scheduling**: Upload full schedules with repeating item logic (`Repeating Breakfast`, `Repeating Lunch`, etc.) across equal or minimum-per-day distribution modes.
- **Smart Admin Pre-selection**: Items with the highest student votes are automatically pre-selected per slot when finalizing sessions.
- **Branded PDF Reports**: One-click PDF generation producing clean, commercial-grade tabular print menus complete with the university logo and nutritional summaries.

---

### 📢 Targeted Announcements & Live Feedback
- **Announcements**: Caterers broadcast real-time updates directly to students assigned to their specific mess type.
- **Live Feedback with AI Summarization**: AI consolidates raw feedback into structured executive summaries for admins and vendors.

---

## 🏗️ Technical Stack

### **Frontend Application**
- **Framework**: React.js powered by Vite for instant HMR.
- **Styling**: Tailwind CSS & Vanilla CSS design system with curated modern typography, micro-animations, and Lucide React iconography.
- **Routing**: React Router DOM (v6) with protected role-based routing (`student`, `caterer`, `admin`, `parent`).
- **Data & Auth Client**: `@supabase/supabase-js` for real-time Postgres subscriptions and session management.

### **Backend Architecture & APIs**
- **Runtime**: Node.js & Express.js.
- **Database & Identity**: Supabase (PostgreSQL) with Row-Level Security (RLS) enforcing strict tenant isolation.
- **Document Generation**: PDFKit for dynamic streamed PDF reports.
- **AI Integration**: Google Gemini API via `@google/generative-ai` for dish suggestions, menu scheduling, and feedback analysis.
- **Rate Limiting**: Tiered rate limiters (`express-rate-limit`) protecting AI, PDF, read, and write endpoints.

---

## 🗄️ Core Database Schema

- **`profiles`**: Linked to `auth.users(id)`. Stores `full_name`, `role` (`student`, `caterer`, `admin`, `parent`), `mess_type`, `reg_number`, `hostel_block`, `room_number`, `parent_email`, `assigned_caterer_id`, and `served_mess_types`.
- **`voting_sessions`**: Temporal bounds of planning phases (`start_date`, `end_date`, `session_weeks`, `status` [draft, open_for_voting, closed, finalized], meal limits).
- **`menu_items`**: Proposed dishes with `meal_type`, `mess_type`, `approval_status`, `is_selected`, `kcal`, and `protein_grams`.
- **`votes`**: Junction table for student votes with per-meal limit constraints.
- **`room_delivery_requests`**: Medical/illness delivery orders (`student_id`, `date`, `meal_type`, `hostel_block`, `room_number`, `reason`, `proof_image_url`, `status`, `admin_notes`).
- **`night_mess_items`**: Late-night menu items (`hostel_block`, `name`, `category`, `price`, `is_available`, `uploaded_by`).
- **`meal_attendance`**: Diner check-in tracking (`student_id`, `date`, `meal_type`, `mess_type`, `check_in_time`, `expected_exit_time`, `source`).
- **`feedbacks`**: Student feedback logs with caterer responses and AI review tracking.
- **`announcements`**: Targeted caterer broadcast messages.
- **`system_settings`**: Global configuration toggles (`caterer_registration`, `admin_registration`, `night_mess_enabled`, `room_delivery_enabled`, `biometric_attendance_enabled`).

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Node.js (v18+ recommended)
- A Supabase project with database migrations applied (`SQL/combined_setup_v1.sql` and `SQL/add_new_features.sql`)

### 2. Environment Configuration
**Server (`/server/.env`):**
```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_google_gemini_api_key
IMGBB_API_KEY=your_imgbb_api_key
```

**Client (`/client/.env.local`):**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

### 3. Installation & Run
```bash
# Install backend dependencies & start server
cd server
npm install
npm run dev

# In another terminal, install frontend dependencies & start client
cd ../client
npm install
npm run dev
```

The frontend will run at `http://localhost:5173` and the backend at `http://localhost:5000`.
