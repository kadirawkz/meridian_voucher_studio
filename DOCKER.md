# Running Meridian Voucher Studio in Docker

This document provides instructions on how to set up, build, and run the Meridian Voucher Studio project completely containerized using Docker and Docker Compose.

---

## Architecture Overview

The containerized setup runs two highly optimized lightweight containers:

1. **`meridian-api` (Port `5000`)**: Runs the standalone Express backend server compiled from TypeScript. It communicates with your Supabase database instance.
2. **`meridian-web` (Port `3000`)**: Builds the Vite React UI and serves it via an Nginx container. Nginx acts as a reverse proxy, forwarding `/api/*` routes directly to the API container.

A custom **web-bridge polyfill** is injected inside browser environments, intercepting Electron IPC requests and converting them into REST API fetch requests seamlessly.

---

## Prerequisites

- **Docker** and **Docker Compose** installed on your host system.
- An active Supabase Database instance.
- A populated `.env` file in the root of the project repository (copy `.env.example` to start).

---

## Configuration

Make sure your `.env` contains your active Supabase connection credentials:

```env
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
MERIDIAN_EMPLOYEE_EMAIL=admin@example.com
```

---

## Quick Start

1. **Build and Start the Containers**:

   ```bash
   docker compose up --build -d
   ```

2. **Verify the Services**:
   - The Web Interface will be active at: **`http://localhost:3000`**
   - The API Server health endpoint can be checked at: **`http://localhost:5000/health`**

3. **Stop the Containers**:
   ```bash
   docker compose down
   ```

---

## Notes & Limitations

> [!IMPORTANT]
> **PDF Document Generation**:
> The desktop application uses Electron's offscreen Chromium rendering pipeline to print HTML templates into clean PDF files. Headless container environments running standard Node.js do not have accessibility to the desktop GUI pipeline.
>
> - **DOCX document generation** works flawlessly inside Docker since it is executed via a pure Node.js template processor (`docxtemplater` + `pizzip`).
> - Selecting the **PDF Generation** action in the browser will fallback to DOCX generation or display a status warning, because Electron's window printing API is disabled in headless contexts.
