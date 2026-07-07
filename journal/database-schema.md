# Database Schema — GoldGoal

## Entity Relationship Diagram

```
users (1) ──────< purchases (many)     ← one user, many purchases
users (1) ──────< goals (many)          ← one user, many goals
users (1) ──────< alerts (many)         ← one user, many alerts

gold_prices      ← independent. Global market data. No FK.
predictions      ← independent. ML model outputs. No FK.
notification_history ← references user_id but NO FK constraint (audit trail survives user deletion)
```

---

## 1. `users`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID (string, 36) | PRIMARY KEY | UUID instead of auto-increment: prevents attackers from guessing other user IDs (`/users/1`, `/users/2`...) |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEXED | Indexed because we query by email on EVERY login. Without index, PostgreSQL scans entire table row-by-row |
| `hashed_password` | VARCHAR(255) | NOT NULL | Stores bcrypt hash (e.g., `$2b$12$...`). NEVER the raw password. `hashed_` prefix is intentional — self-documenting |
| `full_name` | VARCHAR(255) | NOT NULL | Display name. Separate from email for flexibility (users may change names, not emails) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Auto-set by PostgreSQL. Timestamptz = timezone-aware. UTC everywhere, convert to local time in frontend only |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), ON UPDATE | Auto-updates on every row change. Essential for auditing — "when did this user last change anything?" |

---

## 2. `purchases`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID | PRIMARY KEY | Same UUID reasoning |
| `user_id` | UUID | FOREIGN KEY → users.id, ON DELETE CASCADE, INDEXED | Links purchase to user. CASCADE: if user deleted, their purchases go too (no orphan data). Indexed because we query all purchases BY user |
| `purchase_date` | TIMESTAMPTZ | NOT NULL | When was gold actually bought? Separate from `created_at` (when was this record entered?) |
| `grams` | FLOAT | NOT NULL | Quantity. Float is fine for fractional grams (e.g., 10.5g). If this were real money ledgers, we'd use DECIMAL |
| `price_per_gram` | FLOAT | NOT NULL | Price at purchase time. Stored separately so we can calculate total = grams × price_per_gram |
| `total_amount` | FLOAT | NOT NULL | Redundant? Yes — but intentional. Storing it means we don't recalculate on every read. Also captures the actual amount paid (might differ slightly from grams × price due to making charges, GST) |
| `purchase_type` | VARCHAR(50) | NOT NULL | `physical`, `etf`, `bond`. Enum-like but as string — easier to add new types without migration |
| `notes` | VARCHAR(500) | NULLABLE | Optional user note. 500 chars is generous but prevents abuse |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record insertion timestamp. Different from `purchase_date` |

**Key design decision: `total_amount` is stored, not computed.** In a pure normalized DB you'd compute it. But gold purchases in India have making charges, GST, etc. The actual amount paid ≠ grams × price_per_gram. Storing total_amount preserves what the user actually spent.

---

## 3. `goals`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID | PRIMARY KEY | — |
| `user_id` | UUID | FOREIGN KEY → users.id, CASCADE, INDEXED | Each user can have multiple goals |
| `name` | VARCHAR(255) | NOT NULL | "Wedding 2030", "Retirement Fund" — user-defined |
| `target_grams` | FLOAT | NOT NULL | How much gold to accumulate. e.g., 100.0 grams |
| `target_date` | DATE | NOT NULL | Date by which user wants to reach target. DATE (not timestamp) — it's a deadline, not a precise moment |
| `monthly_budget` | FLOAT | NOT NULL, DEFAULT 0.0 | How much user plans to invest monthly. Used to project completion timeline |
| `notes` | VARCHAR(500) | NULLABLE | — |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | — |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), ON UPDATE | — |

---

## 4. `gold_prices`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID | PRIMARY KEY | — |
| `date` | TIMESTAMPTZ | UNIQUE, NOT NULL, INDEXED | One price per day. UNIQUE prevents duplicate daily entries. Indexed because we query price by date and for historical ranges |
| `price_per_gram` | FLOAT | NOT NULL | Market price in ₹ |
| `source` | VARCHAR(100) | NOT NULL, DEFAULT "api" | Where did this price come from? Useful when debugging discrepancies ("why is today's price wrong?" → check source) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | — |

**Why a separate table instead of joining to purchases?** This is the "current market price" — independent of any user. Purchases are historical (what YOU paid). Gold_prices are the market (what gold IS worth). Combining them would couple two unrelated concerns.

---

## 5. `predictions`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID | PRIMARY KEY | — |
| `prediction_date` | TIMESTAMPTZ | NOT NULL, INDEXED | When was this prediction made? |
| `target_date` | TIMESTAMPTZ | NOT NULL | What date is being predicted for? (63 days forward from prediction_date) |
| `predicted_price` | FLOAT | NOT NULL | The ML model's output in ₹/gram |
| `model` | VARCHAR(50) | NOT NULL | Which model made this prediction? `ridge`, `lgbm`, `ensemble`, etc. |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | — |

**Design decision:** Each model's prediction is stored separately (not averaged into one row). Why? Because 6 months later, you want to compare which model was actually most accurate. If you only store the ensemble average, you lose the individual model performances.

---

## 6. `alerts`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID | PRIMARY KEY | — |
| `user_id` | UUID | FOREIGN KEY → users.id, CASCADE, INDEXED | — |
| `alert_type` | VARCHAR(50) | NOT NULL | `price_drop`: notify when gold drops below threshold. `price_rise`: notify when gold rises above threshold. `goal_milestone`: notify when goal reaches 50%, 75%, 100% |
| `threshold_value` | FLOAT | NULLABLE | The trigger value. NULL for goal_milestone alerts (milestones are pre-defined) |
| `is_active` | BOOLEAN | DEFAULT TRUE | User can pause alerts without deleting them |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | — |

---

## 7. `notification_history`

| Column | Type | Constraints | Why |
|--------|------|-------------|-----|
| `id` | UUID | PRIMARY KEY | — |
| `user_id` | UUID | NOT NULL, INDEXED | Who received it. No FK constraint — if user is deleted, audit trail should survive |
| `notification_type` | VARCHAR(50) | NOT NULL | `email`, `sms` |
| `subject` | VARCHAR(255) | NOT NULL | "Gold price dropped below ₹7,000" or "Goal 'Wedding 2030' 50% complete!" |
| `status` | VARCHAR(50) | NOT NULL | `sent` or `failed`. Critical for debugging — "why didn't user get notified?" |
| `sent_at` | TIMESTAMPTZ | DEFAULT NOW() | — |

**Why no FK to users?** This is an audit log. If a user deletes their account and we have a CASCADE FK, their notification history vanishes. We want to keep a record that "we sent 47 emails to user abc-123" even after the user is gone. Compliance/legal reasons.

---

## Schema Design Principles Applied

### 1. Immutable History
Purchases are never modified. `created_at` captures when the record was entered. `purchase_date` captures the actual transaction date. These are different times (user might log an old purchase today).

### 2. Separation of Concerns
- `gold_prices` (market data) is separate from `purchases` (user data)
- `predictions` (ML output) is separate from both
- `notification_history` (audit log) is independent with no FK constraints

### 3. Defensive Design
- UUIDs prevent ID enumeration
- `hashed_password` is never exposed in schemas
- `user_id` always comes from JWT, never from request body
- FK with CASCADE on user-owned tables, NO FK on audit tables

### 4. VARCHAR Enums Over PostgreSQL ENUM
Adding a new `purchase_type` or `alert_type` with VARCHAR requires zero migration. PostgreSQL ENUM `ALTER TYPE` requires a migration. Strings are slightly less efficient but far more maintainable for a small-scale app.

---

## Interview Questions

### "Walk me through your database schema."
Start with users (core entity), then user-owned tables (purchases, goals, alerts), then independent tables (gold_prices, predictions), then audit tables (notification_history). Explain the relationships, key design decisions (UUIDs, stored total_amount, VARCHAR enums), and security considerations.

### "Why store total_amount when you have grams × price_per_gram?"
Making charges, GST, and premiums mean the invoice total ≠ grams × market price. Storing the actual paid amount preserves financial accuracy. Also avoids recalculating on every read.

### "Why is gold_prices a separate table?"
Market data and user data have different lifecycles. Prices update daily from an external API. User purchases are immutable historical records. Coupling them would mean every price update touches purchase-related tables.

### "Why no foreign key on notification_history.user_id?"
Audit trails should survive user deletion. If a user sues claiming they never received alerts, we need the notification log even if their account is gone.

### "Why VARCHAR for enums instead of PostgreSQL ENUM type?"
Zero-migration extensibility. Adding a new purchase type or alert type requires no schema change. Trade-off: slightly less type safety at the DB level, but Pydantic validation catches invalid values before they reach the database.
