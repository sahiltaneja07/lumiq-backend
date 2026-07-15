# Lumiq EV Charging Marketplace Backend (Phase 1)

Lumiq is an Airbnb-like premium marketplace where homeowners (hosts) rent out private EV chargers to drivers.

This repository implements **Phase 1: Project Foundation & Authentication System**.

## Stack
- **Framework:** NestJS (v11)
- **Language:** TypeScript
- **ORM:** Prisma ORM
- **Database:** PostgreSQL
- **Security:** Passport, JWT, bcrypt
- **Documentation:** Swagger (OpenAPI)
- **Logging:** Winston
- **Validation:** class-validator, class-transformer

---

## Clean Architecture & Design Patterns
The project follows **Clean Architecture** principles and the **Repository Pattern** to decouple database queries from business rules:
1. **Controller Layer:** Parses, validates requests (DTOs), and returns structured JSON responses.
2. **Service Layer (Domain Logic):** Coordinates transactional steps, security operations, hashing, and token validation.
3. **Repository Layer:** Encapsulates raw database operations using Prisma.
4. **Data Transfer Objects (DTO):** Strict validation of incoming and outgoing data, removing sensitive fields (`passwordHash`, `failedAttempts`) before sending responses to the client.

---

## Authentication & Security Design
- **Password Strength:** Enforces strong password rules (uppercase, lowercase, numbers, and special symbols).
- **Dual Token JWT auth:**
  - `Access Token` (short-lived, 15m): Attached as `Bearer` header for authenticating requests.
  - `Refresh Token` (long-lived, 7d): Sent as HTTP body parameter to retrieve new access tokens.
- **Token Rotation & Database Revocation:** Each refresh token is hashed (SHA-256) and stored in the database. When a refresh token is reused or rotated, the previous record is revoked.
- **Account Lockout:** Locks accounts for 15 minutes after 5 consecutive failed login attempts (preventing brute-force attacks).
- **Verification & Resets:** Structured to store temporary verification/reset tokens inside a Redis store (TTL-bound).

---

## Setup & Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the parameters:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` is set correctly:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/lumiq?schema=public"
```

### 3. Generate Prisma Client & Migrations
Once your PostgreSQL database is running, generate the Prisma client and apply the migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Running the Dev Server
```bash
npm run start:dev
```
- **REST APIs root URL:** `http://localhost:3000/api/v1`
- **Swagger Documentation:** `http://localhost:3000/api/docs`

---

## Available Phase 1 Endpoints

### 🔐 Authentication (`/api/v1/auth`)
- `POST /auth/register` - Create Driver/Host account
- `POST /auth/login` - Local sign-in (locks account after 5 failures)
- `POST /auth/logout` - Invalidate active session
- `POST /auth/refresh` - Refresh access tokens
- `POST /auth/verify-email` - Check OTP token (using Redis backend)
- `POST /auth/forgot-password` - Request verification link
- `POST /auth/reset-password` - Reset account password
- `POST /auth/change-password` - Update password (authenticated users)
- `GET /auth/google` - Redirect to Google consent screen
- `GET /auth/google/callback` - Receive token from Google callback

### 👤 Profile Management (`/api/v1/users`)
- `GET /users/me` - Fetch own profile details
- `PATCH /users/me` - Update name, phone, bio, avatar
- `POST /users/me/avatar` - Upload avatar file (scaffolded to upload stub)
- `DELETE /users/me/deactivate` - Soft-deactivate own account
- `DELETE /users/me` - Hard-delete account (requires password verification)

### ⚙️ Admin APIs (`/api/v1/admin/users`)
- `GET /admin/users` - Search, filter, and page through users (ADMIN role required)
- `GET /admin/users/:id` - Fetch user by UUID
- `PATCH /admin/users/:id/suspend` - Lock a user account for 30 days
- `PATCH /admin/users/:id/activate` - Remove lock status
- `DELETE /admin/users/:id` - Soft-delete user account

---

## Running Tests
To execute all Unit Tests:
```bash
npm run test -- --forceExit
```
To run tests matching specific services:
```bash
npm run test -- --testPathPatterns="auth.service|users.service" --forceExit
```
