# Traccoon Technical Documentation

## 1. Project Overview
**Traccoon** is a comprehensive, multi-tenant household management application designed to serve as a single source of truth for household financial tracking, budgeting, and inventory management. 

### Tech Stack
- **Backend**: FastAPI (Python), SQLAlchemy (ORM), Alembic (Migrations), PostgreSQL (Database).
- **Frontend**: React Native, Expo (React component framework and routing), TypeScript.
- **State Management**: Zustand (Global state).
- **API Layer**: Axios (with centralized interceptors for token management).
- **Security**: JWT (Access and Refresh tokens), bcrypt (Password hashing).

---

## 2. Main Architecture Rules
The Traccoon architecture adheres to a strict separation of concerns to ensure maintainability and scalability.

1. **Frontend to Backend Flow**: `UI Components/Screens` -> `Zustand State (if global)` -> `Axios API Clients` -> `FastAPI Routers` -> `Services (Business Logic)` -> `Repositories (Data Access)` -> `SQLAlchemy Models` -> `PostgreSQL`.
2. **Backend Architecture (Service-Repository Pattern)**:
   - **Routers**: Handle HTTP requests, parse inputs via Pydantic schemas, and return responses. No business logic resides here.
   - **Services**: Contain pure business logic (e.g., budget calculations, recurring expense generation, authorization checks).
   - **Repositories**: Exclusively handle database interactions (CRUD operations) using SQLAlchemy.
   - **Models**: Define the database schema and relationships.
3. **Frontend Architecture**:
   - **API Clients**: Abstract all Axios HTTP calls.
   - **Zustand Stores**: Manage global state (Auth, Household selection, Currency) and interact with API clients.
   - **Expo Router (`app/`)**: Handles navigation and screen rendering based on directory structure.

---

## 3. Complete Folder Structure

### Backend (`/backend`)
```text
backend/
├── alembic/                 # Database migrations (Alembic)
├── app/
│   ├── core/                # Configuration, security, dependencies
│   ├── models/              # SQLAlchemy ORM models
│   ├── repositories/        # Database access layer
│   ├── routers/             # FastAPI HTTP endpoints
│   ├── schemas/             # Pydantic validation schemas
│   ├── services/            # Business logic
│   └── main.py              # Application entry point
└── requirements.txt         # Python dependencies
```

### Frontend (`/frontend`)
```text
frontend/
├── app/                     # Expo Router pages (Screens)
│   ├── (auth)/              # Authentication screens (Login, Register)
│   ├── (tabs)/              # Main app screens (Home, Expenses, Inventory, etc.)
│   └── _layout.tsx          # Root layout and Auth Gate
├── src/
│   ├── api/                 # Axios clients per domain
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utilities (SecureStore, QueryClient)
│   ├── schemas/             # Zod validation schemas
│   ├── stores/              # Zustand state stores
│   ├── theme/               # Design tokens (Colors, Typography)
│   └── types/               # TypeScript interfaces
└── package.json             # Node dependencies
```

---

## 4. File Responsibilities & Directory Relationships

### Backend Files
- **`app/main.py`**: Initializes FastAPI, configures CORS, and includes all routers.
- **`app/core/config.py`**: Pydantic settings management (DB URL, JWT secrets).
- **`app/core/deps.py`**: Dependency injection (e.g., extracting the current user from JWT).
- **`app/core/security.py`**: Password hashing and JWT generation.
- **Models & Repositories**: Each domain (e.g., `expense.py`, `budget.py`, `inventory.py`) has a corresponding model defining the SQL table and a repository defining the CRUD queries.
- **Routers & Services**: E.g., `routers/expense.py` delegates to `services/expense_service.py` to handle requests and enforce business rules (like checking if a user belongs to a household before creating an expense).

### Frontend Files
- **`app/_layout.tsx`**: Initializes React Query, Safe Area, and the `AuthGate` (which redirects unauthenticated users to `/login`).
- **`app/(tabs)/...`**: Contains the main navigational tabs (Dashboard, Expenses, Budgets, Inventory, Purchases).
- **`src/api/client.ts`**: Configures the base Axios instance, attaching the JWT to headers and silently handling refresh token rotation on `401 Unauthorized` errors.
- **`src/stores/auth-store.ts`**: Zustand store managing the current `user`, `isAuthenticated` flag, and executing login/logout flows.
- **`src/stores/household-store.ts`**: Zustand store managing the user's currently active household.
- **`src/stores/currency-store.ts`**: Zustand store managing localized currency display.

---

## 5. Detailed Feature Explanations & Data Flow

### 1. Authentication (Auth)
- **Flow**: User inputs credentials in `app/(auth)/login.tsx` -> calls `useAuthStore().login()` -> invokes `authApi.login()` -> hits Backend `POST /auth/login`.
- **Backend**: `AuthService` verifies the bcrypt hash and generates short-lived Access Tokens and long-lived Refresh Tokens.
- **State**: Tokens are securely stored via `expo-secure-store`. If an access token expires, the Axios response interceptor (`src/api/client.ts`) uses the refresh token to silently get a new pair.

### 2. Household Management
- **Concept**: Traccoon is multi-tenant. Data (expenses, inventory) belongs to a `Household`, not just a user.
- **Roles**: Owner, Admin, Member, Viewer. The `HouseholdService` verifies the user's role before permitting data modification.

### 3. Expenses
- **Concept**: Tracks money spent. Associated with a Household and optionally a Category.
- **Flow**: Frontend `expensesApi.create()` -> Backend `POST /households/{id}/expenses` -> `ExpenseService` validates input -> `ExpenseRepository` saves to DB.

### 4. Budgets
- **Concept**: Time-bound spending limits linked to Categories.
- **Calculation**: The `BudgetService` dynamically calculates `spent`, `remaining`, and `percentage_used` by querying all expenses within the budget's `period_start` and `period_end` that match the budget's category.

### 5. Recurring Expenses
- **Concept**: Automates the creation of standard expenses (e.g., Rent, Subscriptions).
- **Engine**: The `RecurringExpenseService.generate_due_expenses()` method checks for rules where `next_due_date <= today`.
- **Idempotency**: It creates a standard `Expense` and records a `GeneratedExpenseLog`. The database uses a `UniqueConstraint(recurring_expense_id, occurrence_date)` to guarantee an expense is never generated twice for the same period.

### 6. Inventory & Purchases
- **Inventory**: Tracks household items (quantities, units, low-stock thresholds).
- **Purchases**: Tracks shopping trips. A Purchase contains `PurchaseItem`s.
- **Integration**: While currently separated, the architecture allows for Purchase items to increment Inventory items by linking `inventory_item_id`.

### 7. Dashboard
- **Concept**: The home screen aggregator.
- **Backend Aggregation**: The `DashboardService.get_summary()` executes concurrent or sequential reads across all repositories to gather:
  - Monthly spending totals.
  - Budget utilization.
  - Low stock alerts (`quantity <= low_stock_threshold`).
  - Overdue recurring expenses.
- **Frontend**: The `Dashboard` screen pulls this summary via a single API call (`dashboardApi.get()`), optimizing performance and reducing network requests.

---

## 6. Database Structure & Security

*Note: While the original prompt referenced "Supabase", Traccoon is built on a custom FastAPI + PostgreSQL architecture. Here is how it maps to those concepts:*

- **Database Tables**: Defined via SQLAlchemy Models (`app/models/`). Critical tables include `users`, `households`, `household_members`, `categories`, `expenses`, `budgets`, `inventory_items`, `purchases`, and `recurring_expenses`.
- **Migrations**: Managed by Alembic. Running `alembic upgrade head` applies schema changes to PostgreSQL.
- **Security & RLS (Row Level Security)**: Instead of database-level RLS (like Supabase), Traccoon enforces tenant isolation at the Application Layer via the Service Layer. Every repository query explicitly requires `household_id`, and every router endpoint injects the `get_current_user_id` dependency to verify the user is a valid member of the requested household.
- **Data Integrity**: Extensive use of PostgreSQL `CheckConstraint` (e.g., `amount > 0`) and foreign key cascading.

---

## 7. Developer Onboarding & Best Practices

1. **Adding a New Feature**:
   - **Step 1**: Define the SQLAlchemy Model (`backend/app/models/`).
   - **Step 2**: Create the Alembic Migration (`alembic revision --autogenerate -m "..."`) and run it.
   - **Step 3**: Define Pydantic Schemas (`backend/app/schemas/`).
   - **Step 4**: Implement the Repository and Service logic.
   - **Step 5**: Expose FastAPI Router endpoints and add them to `main.py`.
   - **Step 6**: Add TypeScript types (`frontend/src/types/index.ts`).
   - **Step 7**: Create the Axios API client wrapper (`frontend/src/api/`).
   - **Step 8**: Build the React Native UI (`frontend/app/` or `frontend/src/components/`).
2. **State Management Rules**: Use React Query for server state (fetching, caching, mutating data). Only use Zustand for global, synchronous client state (e.g., Auth Session, Selected Theme, Selected Currency).
3. **Styling**: Always use the design tokens exported from `src/theme/index.ts` to ensure consistent application of the "Akaroa / Mine Shaft" color palette and typography.
