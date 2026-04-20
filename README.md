# Classroom Backend API

A full-stack classroom management system backend built with Express.js, better-auth, Drizzle ORM, and Neon PostgreSQL.

## Tech Stack

- **Runtime**: Node.js + Express.js v5
- **Auth**: [better-auth](https://better-auth.dev/) v1.5 with email/password authentication
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) v0.45 with Neon serverless PostgreSQL
- **Security**: [Arcjet](https://arcjet.com/) (shield, bot detection, rate limiting)
- **Language**: TypeScript (ESM modules)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Arcjet account for security middleware

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@host/database
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
ARCJET_KEY=your-arcjet-key
NODE_ENV=development
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev        # Start with tsx watch (http://localhost:8000)
```

### Database Migrations

```bash
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate    # Apply migrations to database
```

### Build

```bash
npm run build        # Compile TypeScript to ./dist
npm start            # Start production server
```

---

## Database Schema

### Auth Tables

| Table | Description |
|-------|-------------|
| `user` | Core users with role (student/teacher/admin), email, image |
| `session` | Active sessions with expiry, IP, user-agent |
| `account` | OAuth/account provider linking |
| `verification` | Email verification tokens |
| `api_key` | API keys with rate limits and permissions |

### Application Tables

| Table | Description |
|-------|-------------|
| `departments` | Academic departments (code, name, description) |
| `subjects` | Subjects linked to departments |
| `classes` | Class sections with teacher, invite code, schedules (JSONB), capacity |
| `enrollments` | Student-class many-to-many enrollment |
| `class_join_requests` | Pending/accepted/declined join requests |

---

## API Routes

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/auth/*` | better-auth handler (sign-in, sign-up, session) |

### Departments

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/departments` | List departments (paginated, searchable) | requires read permission |

### Subjects

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/subjects` | List subjects (paginated, filterable) | requires read permission |
| GET | `/api/subjects/:id` | Get subject by ID | requires read permission |
| POST | `/api/subjects` | Create subject | requires create permission |
| PUT | `/api/subjects/:id` | Update subject | requires update permission |
| DELETE | `/api/subjects/:id` | Delete subject | requires delete permission |

### Classes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/classes` | List classes (paginated, filterable) | requires read permission |
| GET | `/api/classes/:id` | Get class with subject, department, teacher | requires read permission |
| POST | `/api/classes` | Create class (auto-generates invite code) | requires create permission |
| PATCH | `/api/classes/:id` | Update class | teacher (own classes) or admin |
| DELETE | `/api/classes/:id` | Delete class | teacher (own classes) or admin |

### Enrollments

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/enrollments` | List enrollments (filter by classId/studentId) | requires valid session |

### Users

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/users` | List users (paginated, filterable by role) | requires read permission |
| POST | `/api/users` | Create user (sign up via better-auth) | requires create permission |
| GET | `/api/users/user` | Get current user profile with classes | requires valid session |
| PATCH | `/api/users/user` | Update current user profile | requires valid session |
| DELETE | `/api/users/user` | Delete current user account | requires valid session |

### Class Join Requests

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/class-join-requests` | List join requests | teacher (own classes) or admin or self |
| POST | `/api/class-join-requests` | Submit join request | requires join permission |
| PATCH | `/api/class-join-requests/:id` | Accept/decline request | teacher (own classes) or admin |

---

## Role-Based Access Control

Permissions are defined in `src/lib/role-permissions.ts`:

| Resource | Admin | Teacher | Student |
|----------|-------|---------|---------|
| subject | create, read, update, delete | read | read |
| department | create, read, update, delete | read | read |
| class | create, read, update, delete, join | create, read, update, delete, join | read, join |
| profile | create, read, update, delete | create, read, update, delete | create, read, update, delete |
| student | read, delete | read | - |
| invitation | create, cancel, read | create, read | - |

### Roles

- **student**: Can browse/read departments, subjects, classes; join classes via request
- **teacher**: All student permissions + create/update/delete own classes
- **admin**: Full CRUD on all resources

---

## Security

### Rate Limiting (per-role sliding window, 1 minute)

- Admin: 150 requests/minute
- Teacher/Student: 75 requests/minute
- Guest: 60 requests/minute

### Arcjet Protection

- **Shield**: Blocks common attacks (SQL injection, XSS)
- **Bot Detection**: Blocks automated requests (allows search engine bots)
- **Sliding Window**: Secondary aggressive rate limit (5 req/2s)

---

## Project Structure

```
classroom-backend/
├── src/
│   ├── config/
│   │   └── arcjet.ts          # Arcjet configuration
│   ├── db/
│   │   ├── index.ts           # Drizzle database instance
│   │   └── schema/
│   │       ├── auth.ts        # Auth tables (user, session, account, api_key)
│   │       ├── app.ts         # App tables (department, subject, class, enrollment)
│   │       └── index.ts       # Schema exports
│   ├── lib/
│   │   ├── auth.ts            # better-auth configuration
│   │   ├── permissions.ts     # Permission middleware
│   │   └── role-permissions.ts # Permission matrix
│   ├── middleware/
│   │   └── security.ts        # Arcjet rate limiting middleware
│   ├── routes/
│   │   ├── classes.ts
│   │   ├── class-join-requests.ts
│   │   ├── departments.ts
│   │   ├── enrollments.ts
│   │   ├── subjects.ts
│   │   └── users.ts
│   └── index.ts               # Express app entry point
├── drizzle/                    # Migration files
├── drizzle.config.ts          # Drizzle configuration
├── auth-schema.ts             # [Legacy] better-auth schema
└── package.json
```
