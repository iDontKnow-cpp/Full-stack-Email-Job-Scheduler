# 📬 ReachInbox Full-Stack Email Job Scheduler & Dashboard

A production-grade, distributed email scheduling service and real-time dashboard built for scale. Designed to reliably schedule, throttle, and dispatch thousands of emails while surviving server restarts, adhering to per-sender rate limits, providing live queue observability, and sending instant Slack alerts when provider thresholds are reached.

---

## 🏗 System Architecture

```
                          ┌─────────────────────────────────────┐
                          │     React + Vite SPA Dashboard      │
                          │   (Tailwind CSS, TanStack Query)    │
                          └──────────────────┬──────────────────┘
                                             │ HTTP / REST
                                             ▼
                          ┌─────────────────────────────────────┐
                          │       Express.js TypeScript API     │
                          │   (Auth, Validation, Bull Board)    │
                          └───┬──────────────┬──────────────┬───┘
                              │              │              │
                    Prisma ORM│              │Redis Queue   │Search Index
                              ▼              ▼              ▼
                    ┌────────────┐    ┌────────────┐  ┌───────────────┐
                    │ PostgreSQL │    │   Redis    │  │ Elasticsearch │
                    │ (Campaigns │    │  (BullMQ   │  │  (Full-text   │
                    │ & EmailJobs│    │  & Rate-   │  │   Search on   │
                    │ Persistence│    │  Limiting) │  │  Past/Queued) │
                    └────────────┘    └─────┬──────┘  └───────────────┘
                                            │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │        BullMQ Worker Process        │
                          │   • Configurable Concurrency (5)    │
                          │   • Inter-email Send Delay (2s)     │
                          │   • Redis Atomic Hourly Limiter     │
                          └───────┬─────────────────────┬───────┘
                                  │                     │
                        Rate Limit│Exceeded             │Allowed Send
                                  ▼                     ▼
                       ┌────────────────────┐   ┌────────────────┐
                       │  Slack OAuth v2    │   │ Ethereal SMTP  │
                       │  Channel Alert     │   │ Nodemailer     │
                       │  (Auto-reschedule) │   │ (Preview Link) │
                       └────────────────────┘   └────────────────┘
```

---

## 🚀 Recommended Stack & Implemented Technologies

| Layer | Choice | Rationale & Implementation Details |
|---|---|---|
| **Backend Language** | **TypeScript on Node.js** | Full type safety across queues, models, and API payloads |
| **Backend Framework** | **Express.js** | Lightweight, robust routing with custom middleware and session handling |
| **Queue** | **BullMQ + Redis (ioredis)** | Persistent delayed jobs (**strictly NO cron**), automatic backoff & retry |
| **Database** | **PostgreSQL** | Relational integrity for users, campaigns, and individual job records |
| **ORM** | **Prisma** | Typed database queries, schema migrations, and relational indexing |
| **Email Sending** | **Nodemailer + Ethereal** | Real SMTP protocol testing with live email preview URLs generated per job |
| **Search Engine** | **Elasticsearch (`@elastic/elasticsearch`)** | Multi-match fuzzy search across `to`, `subject`, `body`, and `senderEmail` |
| **Queue Dashboard**| **`@bull-board/express`** | Live web UI at `/admin/queues` for real-time queue metrics and job states |
| **Backend Auth** | **Google OAuth 2.0 (`google-auth-library`) + JWT** | Real Google login with secure HTTP-only cookies and dev fallback |
| **Slack Integration**| **Slack OAuth v2 (`@slack/web-api`)** | Live Slack notifications sent directly to a user's channel on rate limit hit |
| **Validation** | **Zod** | Strictly validated request payloads with descriptive error responses |
| **Frontend** | **React 18 (Vite) + TypeScript** | Blazing-fast SPA with typed props and client components |
| **Styling** | **Tailwind CSS** | Clean, modern UI closely matching the ReachInbox Figma specification |
| **Data Fetching** | **TanStack Query (React Query v5)** | Declarative queries, automatic background polling, and cache invalidation |
| **CSV Parsing** | **PapaParse** | In-browser CSV parsing with email detection, preview, and deduplication |
| **Notifications** | **`react-hot-toast`** | Interactive toasts for successes, warnings, and validation feedback |
| **Infra** | **Docker Compose** | Single command to provision PostgreSQL, Redis, and Elasticsearch |

---

## ✨ Features Implemented

### 🖥 Backend
- [x] **No Cron Jobs Constraint**: Strictly uses BullMQ delayed jobs backed by Redis sorted sets (`ZADD`). No OS cron, no `node-cron`, no `agenda`.
- [x] **Relational Persistence**: All campaigns and individual email jobs are stored in PostgreSQL via Prisma with explicit states: `SCHEDULED`, `QUEUED`, `SENDING`, `SENT`, `FAILED`, and `RATE_LIMITED`.
- [x] **Restart & Crash Resilience**:
  - Delayed jobs stay persisted in Redis with AOF persistence.
  - On backend startup, `recoverPendingJobs()` scans the database for any past-due jobs and re-enqueues them automatically.
  - Zero duplicate sends guaranteed via per-job `idempotencyKey` (`${campaignId}:${recipientEmail}`).
- [x] **Worker Concurrency**:
  - Configurable via `WORKER_CONCURRENCY` (default: `5`).
  - Safe for parallel workers across multiple instances.
- [x] **Inter-Email Delay (Provider Throttling)**:
  - Minimum delay between sends configured via `MIN_DELAY_BETWEEN_EMAILS_MS` (default: `2000ms` / 2 seconds).
  - Enforced using BullMQ's token bucket limiter (`limiter: { max: 1, duration: 2000 }`).
- [x] **Hourly Rate Limiting**:
  - Configurable per-sender hourly limit via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: `200/hr`).
  - Multi-worker safe using an atomic Redis Lua script (`INCR` + conditional `EXPIRE` over 1-hour windows `Math.floor(Date.now() / 3600000)`).
  - When limit is reached: jobs are **never dropped**. The worker reschedules them into the start of the next hour window and marks status as `RATE_LIMITED`.
- [x] **Live Slack Rate-Limit Alerts**:
  - Slack OAuth v2 flow: User connects Slack -> token and channel stored per user.
  - Instant Slack message posted via `@slack/web-api` when a sender's rate limit is reached.
  - Debounced with a 1-hour Redis lock so users aren't spammed with duplicate alerts in the same window.
  - Safe disconnect/reconnect: system never crashes if Slack is disconnected or tokens are invalid.
- [x] **Full-Text Search via Elasticsearch**:
  - Automatically indexes all email jobs upon scheduling and updates on send/fail.
  - Multi-field fuzzy queries on `to`, `subject`, `body`, and `senderEmail`.
  - Automatic graceful fallback to PostgreSQL ILIKE queries if Elasticsearch is temporarily offline.
- [x] **Bull Board Monitoring**: Live UI at `http://localhost:3001/admin/queues` showing active, delayed, completed, and failed jobs.

### 🎨 Frontend
- [x] **Google OAuth Login**:
  - Sign-in with Google button following the official design.
  - Displays user profile (avatar, name, email) in header navigation.
  - One-click sign-out with session termination.
  - Dev login button enabled in development environments for immediate testing.
- [x] **Dashboard Overview**:
  - Aggregate statistics cards: **Total Scheduled**, **Total Sent**, **Total Failed**.
  - Auto-refreshing tabs for **Scheduled Emails** and **Sent Emails**.
  - Full-text search bar with live debouncing and server-side filtering.
  - Pagination controls with configurable page limits.
  - Status badges with distinct color-coding for all 6 job states.
- [x] **Compose & Schedule Modal**:
  - Drag-and-drop CSV upload via PapaParse.
  - Automatic extraction and validation of recipient email addresses.
  - Recipient count indicator with preview tags and individual removal.
  - Manual single-recipient addition option.
  - Custom start time picker (`datetime-local`).
  - Configurable send delay (seconds) and per-campaign hourly limit.
- [x] **Sent Email Inspection**:
  - Displays sent timestamp and final delivery status.
  - "View" preview link that directly opens the Ethereal email in a new browser tab.
- [x] **Slack Integration Controls**:
  - Header Slack indicator showing live connected team name.
  - "Connect Slack" button initiating real Slack OAuth v2.
  - Disconnect Slack option inside the user profile dropdown.

---

## 🛠 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker & Docker Compose**: For PostgreSQL, Redis, and Elasticsearch

---

## ⚙️ Quick Start

### 1. Clone & Setup Environment

```bash
git clone <your-repo-url>
cd "Full-stack Email Job Scheduler"
```

Configure backend environment variables:
```bash
cp backend/.env.example backend/.env
```

Review `backend/.env` (default values work out of the box with Docker Compose):
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database & Redis
DATABASE_URL=postgresql://scheduler:scheduler123@localhost:5432/email_scheduler
REDIS_HOST=localhost
REDIS_PORT=6379

# Concurrency & Rate Limiting
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
```

---

### 2. Start Infrastructure (PostgreSQL, Redis, Elasticsearch)

Start all backing services using Docker Compose:

```bash
docker compose up -d
```

This starts:
- **Redis** on `localhost:6379` (with AOF persistence enabled)
- **PostgreSQL 15** on `localhost:5432` (`user: scheduler`, `password: scheduler123`, `db: email_scheduler`)
- **Elasticsearch 8.11** on `localhost:9200` (single-node, security disabled for local dev)

---

### 3. Initialize Database

Run Prisma migrations/push to initialize the schema:

```bash
cd backend
npm run db:push
```

*(Optional)* Seed demo data:
```bash
npm run db:seed
```

---

### 4. Start Backend Server & Worker

In the `backend` directory:

```bash
npm run dev
```

The backend starts:
- Express API server on `http://localhost:3001`
- BullMQ email worker with concurrency = 5 and inter-email limiter = 2s
- Auto-initializes Ethereal test account (if not configured in `.env`)
- Auto-creates the Elasticsearch `emails` index
- Bull Board Queue Dashboard at `http://localhost:3001/admin/queues`

---

### 5. Start Frontend Dashboard

In a separate terminal, navigate to `frontend`:

```bash
cd frontend
npm run dev
```

Open your browser at: **`http://localhost:5173`**

---

## ☸️ Kubernetes Deployment with Horizontal Pod Autoscaling (HPA)

For production-grade scalability, fault tolerance, and automated load balancing, the scheduler can be deployed to any Kubernetes cluster (Minikube, Kind, k3s, EKS, GKE, AKS, or bare metal).

### 🏗 Kubernetes Architecture Overview

```
                                [ External Ingress / NodePort 30080 ]
                                                  │
                      ┌───────────────────────────┴───────────────────────────┐
                      │                                                       │
               [ /api , /admin/queues ]                                    [ / (SPA) ]
                      ▼                                                       ▼
            ┌───────────────────┐                                   ┌───────────────────┐
            │  backend-service  │                                   │  frontend-service │
            │   (ClusterIP)     │                                   │ (NodePort: 30080) │
            └─────────┬─────────┘                                   └─────────┬─────────┘
                      │                                                       │
                      ▼                                                       ▼
            ┌───────────────────┐                                   ┌───────────────────┐
            │backend-deployment │◄─── [ backend-hpa ]               │frontend-deployment│◄─── [ frontend-hpa ]
            │  (2 - 10 Replicas)│     (CPU > 70%, Mem > 80%)        │  (2 - 8 Replicas) │     (CPU > 75%)
            └─────────┬─────────┘                                   └───────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   ┌───────────┐┌───────────┐┌───────────────┐
   │ postgres  ││   redis   ││ elasticsearch │
   │ (Stateful ││ (Stateful ││  (Stateful    │
   │  PVC 5Gi) ││  PVC 2Gi) ││   PVC 5Gi)    │
   └───────────┘└───────────┘└───────────────┘
```

### 1. Build Docker Images

Build both multi-stage, production-optimized container images:

```bash
# Build backend (Alpine, dumb-init, non-root user, multi-stage)
docker build -t email-scheduler-backend:latest ./backend

# Build frontend (Alpine, Nginx reverse-proxy & SPA fallback, multi-stage)
docker build -t email-scheduler-frontend:latest ./frontend
```

*(Or use the convenience npm command from the root directory)*:
```bash
npm run docker:build
```

> **Minikube / Kind users**: If using a local cluster, load the images directly into your cluster:
> ```bash
> # For Minikube:
> minikube image load email-scheduler-backend:latest
> minikube image load email-scheduler-frontend:latest
>
> # For Kind:
> kind load docker-image email-scheduler-backend:latest
> kind load docker-image email-scheduler-frontend:latest
> ```

---

### 2. Deploy Everything with a Single Command

All Kubernetes manifests are bundled with **Kustomize** inside [`k8s/`](file:///home/u/Projects/Full-stack%20Email%20Job%20Scheduler/k8s/):

```bash
kubectl apply -k k8s/
```

This creates:
- **Namespace**: `email-scheduler`
- **ConfigMap & Secret**: Shared environment variables, Redis/Postgres/ES endpoints, and secrets
- **Stateful Storage (PVCs)**:
  - `postgres-pvc` (5Gi)
  - `redis-pvc` (2Gi)
  - `elasticsearch-pvc` (5Gi)
- **Infrastructure Services**:
  - `postgres-service:5432`
  - `redis-service:6379`
  - `elasticsearch-service:9200`
- **Database Initialization Job**: One-time `prisma-db-push` job that runs `npx prisma db push` to prepare the database schema
- **Backend Deployment & Service**:
  - `backend-deployment` (2 initial replicas, rolling updates, readiness & liveness probes on `/health`)
  - `backend-service:3001` (ClusterIP)
- **Frontend Deployment & Service**:
  - `frontend-deployment` (2 initial replicas, Nginx SPA router, readiness & liveness probes on `/healthz`)
  - `frontend-service` (NodePort `30080` for immediate browser access)
- **Horizontal Pod Autoscalers (HPA)**:
  - `backend-hpa`: Scales from **2 to 10 pods** based on CPU (> 70%) and Memory (> 80%)
  - `frontend-hpa`: Scales from **2 to 8 pods** based on CPU (> 75%)
- **Ingress**: Reverse proxy rules routing `/api` and `/admin/queues` to the backend, and `/` to the frontend

---

### 3. Check Deployment & Autoscaler Status

```bash
kubectl get all,hpa,pvc -n email-scheduler
```

Example output:
```
NAME                                       READY   STATUS      RESTARTS   AGE
pod/backend-deployment-7bb5df74bf-42x8l    1/1     Running     0          45s
pod/backend-deployment-7bb5df74bf-z89pk    1/1     Running     0          45s
pod/elasticsearch-69f8897587-n624p         1/1     Running     0          45s
pod/frontend-deployment-79549cd97c-k987m   1/1     Running     0          45s
pod/frontend-deployment-79549cd97c-q542l   1/1     Running     0          45s
pod/postgres-74567ffbb9-wtxvl              1/1     Running     0          45s
pod/prisma-db-push-6z4lp                   0/1     Completed   0          35s
pod/redis-66b9f485db-87vbx                 1/1     Running     0          45s

NAME                                            REFERENCE                       TARGETS                       MINPODS   MAXPODS   REPLICAS
horizontalpodautoscaler.autoscaling/backend-hpa   Deployment/backend-deployment   cpu: 12%/70%, mem: 34%/80%    2         10        2
horizontalpodautoscaler.autoscaling/frontend-hpa  Deployment/frontend-deployment  cpu: 5%/75%                   2         8         2
```

---

### 4. Access the Application

- **Frontend Dashboard**:
  - Via NodePort: [`http://localhost:30080`](http://localhost:30080)
  - Via Minikube service URL: `minikube service frontend-service -n email-scheduler`
  - Via Ingress (if ingress controller is enabled): `http://localhost/`
- **Bull Board Queue Dashboard**: [`http://localhost:30080/admin/queues`](http://localhost:30080/admin/queues)
- **Backend API Health Check**: [`http://localhost:30080/api/health`](http://localhost:30080/api/health)

---

### 5. How Horizontal Pod Autoscaling (HPA) Works in this System

1. **Distributed Queue Processing**:
   - Each backend replica runs both the Express API and a BullMQ Worker instance with 5 concurrent workers.
   - When 2 pods are running, the cluster handles **10 concurrent jobs**.
   - As traffic or scheduled job volume surges and CPU/Memory exceeds thresholds, HPA scales the backend up to **10 pods**, delivering **50 concurrent workers**.
2. **Race-Condition & Duplicate Prevention**:
   - **Startup Recovery Lock**: When new backend pods spin up simultaneously during scale-out, a Redis distributed lock (`lock:startup_recovery`) ensures only one pod runs the database recovery scan.
   - **Queue Level Idempotency**: Jobs are registered with a deterministic `jobId: emailJob.emailJobId`. If multiple workers attempt to enqueue the same job, Redis atomically ignores duplicates.
   - **Atomic Rate Limiter**: All scaled worker pods share the same atomic Redis Lua script counter (`ratelimit:{senderEmail}:{hourWindow}`). Concurrency across pods never compromises hourly limits.
3. **Graceful Scale-Down**:
   - Scale-down stabilization window is configured to **300 seconds (5 minutes)**. This prevents premature pod termination during temporary rate-limiting pauses or short job gaps.
   - `dumb-init` traps SIGTERM and triggers graceful worker shutdown, finishing currently active SMTP socket sends before the pod terminates.

---

### 6. Clean Up Kubernetes Resources

To delete all deployments, services, pods, and PVCs:

```bash
kubectl delete -k k8s/
```

---

## 📧 Ethereal Email Configuration

Ethereal is a fake SMTP service used for testing email deliveries safely:

1. **Automatic Mode (Default)**:
   - If `ETHEREAL_USER` and `ETHEREAL_PASS` are left empty in `.env`, the backend automatically generates a disposable test account on startup via `nodemailer.createTestAccount()`.
   - Credentials and account URL are printed in the backend console logs.
   - Every sent email generates an ethereal preview URL accessible directly from the **Sent Emails** table in the frontend dashboard.

2. **Custom Account Mode**:
   - Visit [https://ethereal.email/create](https://ethereal.email/create) to generate a permanent test account.
   - Set in `backend/.env`:
     ```env
     ETHEREAL_USER=your_user@ethereal.email
     ETHEREAL_PASS=your_ethereal_password
     ```

---

## 🔐 Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized redirect URIs**:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
4. Copy the Client ID and Client Secret into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
   ```
5. *(Dev Mode Fallback)*: When testing locally without Google credentials, a demo login bypass is available at `/api/auth/dev-login`.

---

## 💬 Slack OAuth Setup (Rate Limit Alerts)

1. Create a Slack App at [https://api.slack.com/apps](https://api.slack.com/apps).
2. Under **OAuth & Permissions**, add the following **Bot Token Scopes**:
   - `chat:write` (to post alert messages)
   - `channels:read` (to auto-detect the alert channel)
3. Set **Redirect URLs**:
   ```
   http://localhost:3001/api/slack/callback
   ```
4. Copy Client ID and Secret to `backend/.env`:
   ```env
   SLACK_CLIENT_ID=your-slack-client-id
   SLACK_CLIENT_SECRET=your-slack-client-secret
   SLACK_REDIRECT_URI=http://localhost:3001/api/slack/callback
   ```
5. In the frontend dashboard, click **"Connect Slack"** to authorize. Once connected, when any sender exceeds the configured hourly rate limit, an automated alert will be dispatched to your Slack channel!

---

## 🔬 Deep-Dive: Core Technical Solutions

### 1. How Scheduling Works (Strictly No Cron)
- Each email job in a campaign is assigned an exact execution timestamp based on:
  $$\text{scheduledAt} = \text{startTime} + \left(\left\lfloor \frac{i}{\text{hourlyLimit}} \right\rfloor \times 3600\,\text{s}\right) + (i \bmod \text{hourlyLimit}) \times \text{delaySeconds}$$
- A BullMQ delayed job is pushed to Redis with `delay = scheduledAt - Date.now()`.
- BullMQ stores delayed jobs in a Redis sorted set (`ZSET`) keyed by execution timestamp.
- When the delay expires, Redis automatically moves the job into the active queue for worker consumption.

### 2. How Persistence Across Server Restarts Is Guaranteed
1. **Redis Persistence**: Redis is run with `appendonly yes` (`AOF`), meaning job states and delayed schedules survive process or container restarts.
2. **Database Truth**: Every job is stored in PostgreSQL with its `scheduledAt` date and unique `bullJobId`.
3. **Startup Recovery Hook (`recoverPendingJobs`)**:
   - On backend boot, the server queries PostgreSQL for any jobs in `SCHEDULED` or `QUEUED` status whose `scheduledAt` is $\le \text{now}$.
   - Any past-due jobs that were waiting during a downtime are immediately re-enqueued with `delay = 0` to execute without delay.
   - Future scheduled jobs without a registered `bullJobId` are re-scheduled with their remaining delay.
4. **Idempotency Guard**:
   - Every `EmailJob` has an `idempotencyKey` formatted as `${campaignId}:${recipientEmail}` with a database unique constraint.
   - Before sending, the worker checks if the job was already marked `SENT`. If so, it safely aborts duplicate execution.

### 3. How Rate Limiting & Concurrency Are Enforced Across Workers
- **Worker Concurrency**: Set to `5` by default (`WORKER_CONCURRENCY`). Up to 5 worker threads execute jobs concurrently per instance.
- **Provider Throttling**: BullMQ limiter configured with `max: 1, duration: 2000ms`, ensuring at least 2 seconds between individual sends from the worker.
- **Atomic Hourly Rate Limiter**:
  - Key format: `ratelimit:{senderEmail}:{hourWindow}` where `hourWindow = Math.floor(Date.now() / 3600000)`.
  - Executed atomically using Redis Lua script:
    ```lua
    local current = redis.call('GET', KEYS[1])
    if current and tonumber(current) >= tonumber(ARGV[1]) then
      return {0, tonumber(current)}
    end
    local newVal = redis.call('INCR', KEYS[1])
    if newVal == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[2])
    end
    return {1, newVal}
    ```
  - If limit is reached:
    - Worker triggers a live Slack alert via `notifyRateLimit()`.
    - Reschedules the job to `Date.now() + timeUntilNextHour`.
    - Updates status to `RATE_LIMITED`.
    - Returns gracefully without throwing errors or dropping jobs.

---

## 📁 Repository Structure

```
.
├── docker-compose.yml              # PostgreSQL, Redis, Elasticsearch containers
├── package.json                    # Root helper scripts
├── problem_statement.txt           # ReachInbox original technical challenge spec
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # User, Campaign, EmailJob relational models
│   │   └── seed.ts                 # Sample demo data seeding script
│   ├── src/
│   │   ├── config/env.ts           # Type-safe Zod environment validation
│   │   ├── lib/
│   │   │   ├── bullmq.ts           # BullMQ queue & delayed scheduling factory
│   │   │   ├── redis.ts            # ioredis client & subscriber connection
│   │   │   ├── ethereal.ts         # Nodemailer transporter & preview URL helper
│   │   │   ├── elasticsearch.ts    # Elasticsearch client, indexer & search queries
│   │   │   └── prisma.ts           # Prisma singleton client
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT token & cookie authentication guard
│   │   │   └── validate.ts         # Zod schema validation middleware
│   │   ├── routes/
│   │   │   ├── auth.ts             # Google OAuth & session routes
│   │   │   ├── emails.ts           # Campaign schedule, list, search & stats APIs
│   │   │   └── slack.ts            # Slack OAuth v2 connect & status routes
│   │   ├── services/
│   │   │   ├── rateLimiter.ts      # Atomic Redis-backed hourly counter logic
│   │   │   └── slackNotifier.ts    # Slack WebClient notification dispatcher
│   │   ├── workers/
│   │   │   └── emailWorker.ts      # BullMQ worker processor with throttling
│   │   ├── types/index.ts          # Shared backend TypeScript types
│   │   └── index.ts                # Express bootstrap, recovery hook & graceful shutdown
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── api/                    # Typed API client modules (auth, emails, slack)
    │   ├── components/
    │   │   ├── dashboard/          # ScheduledEmailsTable, SentEmailsTable, ComposeModal, StatsCards
    │   │   ├── layout/             # Top Header with Slack indicator, AuthGuard
    │   │   └── ui/                 # Reusable Button, Input, Modal, Badge, Table, etc.
    │   ├── hooks/                  # TanStack Query custom hooks (useEmails, useAuth, useSlack)
    │   ├── pages/                  # LoginPage, DashboardPage, AuthCallbackPage
    │   ├── types/                  # TypeScript interfaces matching backend models
    │   ├── App.tsx                 # React Router routing configuration
    │   └── main.tsx                # React entry point with QueryClientProvider
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## 🧪 Testing Under Load

To simulate 1000+ emails scheduled simultaneously:
1. Prepare a CSV file with 1,000 email addresses (e.g. `user1@example.com` to `user1000@example.com`).
2. Open the **Compose Modal** in the dashboard and drop the CSV.
3. Configure:
   - **Start Time**: Now
   - **Delay Between Emails**: 1 second
   - **Hourly Limit**: 200
4. Click **Schedule Campaign**.
5. Result:
   - First 200 emails will be queued for the first hour window.
   - The remaining 800 emails are automatically pre-partitioned into consecutive 1-hour windows.
   - Real-time progress is visible in the **Scheduled Emails** tab and on the Bull Board at `http://localhost:3001/admin/queues`.

---

## 👥 Access & Submission

Repository maintained for ReachInbox technical review.
Access granted to reviewers: `Mitrajit` and `Yadav036`.

