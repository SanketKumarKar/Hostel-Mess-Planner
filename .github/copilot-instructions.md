# FeastFull repository instructions

- This repository contains a React/Vite frontend in the client folder and an Express server in the server folder.
- Keep frontend and backend changes scoped to the appropriate directory and avoid mixing concerns.
- Prefer the existing component, route, and utility patterns already used by the app instead of introducing new abstractions.
- Protect secrets and credentials by using environment variables and never hard-coding them into source files.
- When making changes, preserve role-based flows for admin, caterer, and student users and keep the app accessible and responsive.
- Keep the client build and the server entrypoint syntax valid when you change code.
