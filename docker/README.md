# Local Supabase Docker Environment

This directory provides a local, self-contained Supabase stack that mirrors the cloud Supabase environment without cloud dependency.

## Included Services

- **Kong API Gateway** (Port `8000`): Single routing endpoint for Auth, REST, Realtime, and Storage APIs.
- **Supabase Studio UI** (Port `54323`): Local web dashboard (Table Editor, SQL Editor, User Management).
- **PostgreSQL 15** (Port `5432`): Database with `pgcrypto` and `uuid-ossp` extensions.
- **Automated Schema Bootstrap**: Mounts `supabase-schema-patch.sql` to initialize all 10 tables, triggers, and RLS policies on first run.
- **GoTrue Auth** (Port `9999` via Kong `/auth/v1`): Authentication microservice.
- **PostgREST** (Port `3000` via Kong `/rest/v1`): Automatic REST API layer.
- **Supabase Realtime** (Port `4000` via Kong `/realtime/v1`): WebSockets for live table updates.

## Quick Start

1. Start all services in the background:
   ```bash
   docker compose -f docker/docker-compose.yml --env-file docker/.env.docker up -d
   ```

2. Access the Supabase Studio dashboard in your browser:
   ```
   http://localhost:54323
   ```

3. Configure your frontend application:
   In your root `.env` or `.env.local` file, update the Supabase environment variables:
   ```env
   VITE_SUPABASE_URL=http://localhost:8000
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWZlcmVuY2UiOiJsb2NhbCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg0ODQxNjAwLCJleHAiOjE5NDI2MDg0MDB9.PZ5_wP_b6yq_76T_jK2QjLw6iY8F7QkUv3H6U9R3kQE
   ```

4. Stop all services when finished:
   ```bash
   docker compose -f docker/docker-compose.yml down
   ```

