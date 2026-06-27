# Running Meridian Voucher Studio in Docker

This document outlines the architecture, setup requirements, configuration steps, and operational guidelines for running **Meridian Voucher Studio** completely containerized via Docker and Docker Compose.

---

## 📐 Architecture Overview

The containerized setup orchestrates two lightweight, production-ready services:

1. **`meridian-api` (Port `5000`)**
   - Serves as the standalone Express backend compiled from TypeScript.
   - Handles the API requests and interacts directly with your Supabase database instance.
   - Executes server-side document generation.

2. **`meridian-web` (Port `3000`)**
   - Builds the React frontend (Vite-powered) and hosts it via an Nginx web server.
   - Nginx handles routing and acts as a reverse proxy, seamlessly routing `/api/*` traffic to the backend API container.

A specialized **web-bridge polyfill** is automatically activated in browser contexts to intercept IPC calls and route them through standard REST API requests.

```text
[ Browser Client ] ---> ( Port 3000 / Nginx )
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             [ Static Assets ]     [ /api/* Proxy ]
                                        │
                                        ▼
                            ( Port 5000 / Express API )
                                        │
                                        ▼
                             [( Supabase Database )]
```

---

## 📋 Prerequisites

Before proceeding, ensure you have installed:
- **Docker** (v20.10.0 or higher)
- **Docker Compose** (v2.0.0 or higher)
- An active **Supabase** instance configured

---

## ⚙️ Configuration

Your root `.env` file supplies necessary configuration parameters at build and runtime. Ensure the following variables are correctly configured:

```env
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
MERIDIAN_EMPLOYEE_EMAIL=admin@example.com
```

- **Runtime Configuration**: The Express API server reads the `.env` values dynamically.
- **Build-Time Configuration**: The web React image consumes `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Compose build arguments to embed them safely into the static client bundle.

---

## 🚀 Quick Start Guide

Follow these steps to launch the stack locally:

### 1. Start Services
To build the images and run the containers in detached (background) mode:
```bash
docker compose up --build -d
```

### 2. Verify Deployments
You can monitor service health and access endpoints at:
- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

*Note: The web container configuration waits until the API server's health check returns `200 OK` before starting to serve traffic.*

### 3. Retrieve Container Logs
To inspect logs across all services:
```bash
docker compose logs -f
```

To isolate logs for a single service:
```bash
docker compose logs -f meridian-api
```

### 4. Stop Services
To stop running containers and tear down the virtual network:
```bash
docker compose down
```

To also destroy persistent volumes:
```bash
docker compose down -v
```

---

## 📝 Web-Bridge Compatibility Features

The containerized environment supports all key features of the application, utilizing browser-native and containerized service fallbacks:

- **PDF Generation**: Runs headlessly inside the `meridian-api` container via Chromium and `puppeteer-core`.
- **Tour Explorer**: Enabled in the browser using the **File System Access API** (`window.showDirectoryPicker()`). This lets users select a local directory and saves generated documents directly onto their local hard drive.
- **Email client integration**: Launches your default mail handler natively from the browser using a `mailto:` link, and automatically downloads the generated PDF so you can attach it with a simple drag-and-drop.
