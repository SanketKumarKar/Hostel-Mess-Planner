# Hostel Menu Planner 🍽️

A comprehensive full-stack web application designed to streamline the process of menu planning, voting, and finalization for hostel messes. This platform connects Students, Caterers, and Administrators in a unified ecosystem to ensure a democratic and organized food selection process.

![Hostel Menu Logo](./client/public/logo.png)

## 🌟 Features

### 👨‍🎓 Student Portal
-   **Interactive Dashboard**: View upcoming menu sessions and their status (Draft, Voting Open, Finalized).
-   **Voting System**: Cast votes for preferred menu items for Breakfast, Lunch, Snacks, and Dinner.
-   **Smart Conflict Resolution**: Automatic clearing of previous votes if the student changes their mess preference (e.g., Veg to Non-Veg).
-   **Historical Data**: Access past finalized menus via a session switcher.
-   **Mobile Responsive**: Optimized for voting on the go.

### 👨‍🍳 Caterer Portal
-   **Menu Management**: Easy-to-use interface to add items to a "Draft" session.
-   **Structured Planning**: Items are automatically grouped by Date and Meal Type.
-   **Visual Cues**: Color-coded indicators for Veg (Green), Non-Veg (Orange), and Special (Purple) items.
-   **Draft Mode**: Work on the menu in private ("Planning in Progress" visible to students) before opening it for voting.

### 🛡️ Admin Portal
-   **Session Control**: Create new voting sessions and manage their lifecycle (Draft -> Open -> Finalized).
-   **PDF Generation**: Auto-generate comprehensive PDF reports of the finalized menu based on highest votes.
-   **User Management**: Oversee registered users and system settings.

## 🛠️ Tech Stack

### Frontend
-   **Core**: React (v18+), TypeScript, Vite
-   **Styling**: TailwindCSS (v4)
-   **Routing**: React Router DOM
-   **State/Data**: Supabase Client, Axios
-   **Icons**: Lucide React

### Backend
-   **Runtime**: Node.js, Express
-   **Database**: Supabase (PostgreSQL)
-   **PDF Generation**: PDFKit
-   **Authentication**: Supabase Auth

## 🚀 Getting Started

### Prerequisites
-   Node.js (v18 or higher)
-   npm or yarn
-   A Supabase project (for database and auth)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/SanketKumarKar/Hostel-Mess-Planner.git
    cd Hostel-Mess-Planner
    ```

3.  **Database Setup**
    *   Navigate to your Supabase project's **SQL Editor**.
    *   Open and run the scripts from the `SQL/` folder in the following order:
        1.  `schema.sql` (Creates tables and security policies)
        2.  `setup_data.sql` (Inserts initial data like mess types)
        3.  `import_sample_menu.sql` (Optional: Adds sample menu items)

4.  **Environment Setup**
    Create a `.env` file in the `server` directory and a `.env.local` file in the `client` directory with your Supabase credentials.

    **Server (.env)**
    ```env
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_anon_key
    PORT=5000
    ```

    **Client (.env.local)**
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

3.  **Install Dependencies**

    *Client:*
    ```bash
    cd client
    npm install
    ```

    *Server:*
    ```bash
    cd ../server
    npm install
    ```

### Running the Application

1.  **Start the Backend Server**
    ```bash
    cd server
    node index.js
    ```
    The server will start on port 5000 (or your configured port).

2.  **Start the Frontend Client**
    ```bash
    cd client
    npm run dev
    ```
    The application will be accessible at `http://localhost:5173`.

## 📂 Project Structure

```
root
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components (Layout, etc.)
│   │   ├── pages/          # Dashboard pages (Admin, Student, Caterer)
│   │   ├── context/        # Auth Context
│   │   └── ...
│   └── ...
├── server/                 # Express Backend
│   ├── index.js           # Server entry point
│   ├── pdfGenerator.js    # Logic for generating Menu PDFs
│   └── ...
└── SQL/                    # Database schemas and setup scripts
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

---
Made with ❤️ by **Sanket Kar**
