# Security Architecture — GoldGoal

## Core Principle: Defense in Depth

Security is not one check. It's layered. Every layer catches what the previous layer missed.

```
Request arrives
    │
    ▼
[Layer 1] No Authorization header? → 403 Forbidden. Stop.
    │
    ▼
[Layer 2] Token signature invalid or expired? → 401 Unauthorized. Stop.
    │
    ▼
[Layer 3] Token decoded, but user not in DB? → 401 Unauthorized. Stop.
    │
    ▼
[Layer 4] Schema validation — illegal fields? negative values? → 422. Stop.
    │
    ▼
[Layer 5] Business logic — user_id from JWT, not request body. No IDOR.
    │
    ▼
Request reaches service function (only if ALL layers passed)
```

---

## Attack Types We Defend Against

### 1. No Token (Unauthenticated Access)

**What attacker does:** Calls `POST /portfolio/purchases` without any Authorization header.

**Layer 1 defense:** `Depends(get_current_user)` → `HTTPBearer()` looks for the header. Not found → 403 Forbidden. The route function body **never executes**.

**Why 403 and not 401?** `403 = "you're logged out, go away."` `401 = "we don't recognize those credentials."` Both are fine; FastAPI default is 403 for missing header, 401 for invalid token.

---

### 2. Fake Token

**What attacker does:** Sends `Authorization: Bearer fakefakefake` (made-up string).

**Layer 2 defense:** `jwt.decode("fakefakefake", SECRET_KEY)` fails. The string wasn't signed with our secret key → `JWTError` → 401 Unauthorized.

**Why this works:** JWT is cryptographically signed using HMAC-SHA256. Without the secret key, no one can generate a valid signature. Brute-forcing a 256-bit key would take longer than the age of the universe.

---

### 3. Expired Token

**What attacker does:** Uses a real token that's older than 60 minutes.

**Layer 2 defense:** JWT contains `"exp": 1734567890` (Unix timestamp). `jwt.decode()` checks this automatically. If current time > expiry → `JWTError` → 401.

**Why 60 minutes?** Trade-off between security and convenience:
- Too short (5 min) → user gets logged out constantly, annoying
- Too long (7 days) → if token is stolen, attacker has access for a week
- 60 minutes = good balance. Refresh tokens (Phase 6+) can extend sessions securely.

---

### 4. Token Valid but User Deleted

**What attacker does:** Has a valid token for user "abc-123", but that user was deleted from the database.

**Layer 3 defense:** Token decodes successfully → extracts `user_id = "abc-123"` → queries DB → user not found → 401 Unauthorized. The token alone isn't enough — the user must still exist.

**Why this matters:** If an admin deletes a compromised account, all existing tokens for that user become useless immediately, even if not expired.

---

### 5. IDOR — Insecure Direct Object Reference (Person D)

**What attacker does:** User "abc-123" sends a valid request but tries to access/modify user "xyz-999"s data. This is the most common and most dangerous web vulnerability.

**How it could happen without protection:**

```
POST /portfolio/purchases
Header: Authorization: Bearer <valid token for abc-123>
Body: {"user_id": "xyz-999", "grams": 10, ...}
```

If the server used `data.user_id` from the body, the purchase would be saved under xyz-999's account. User A just corrupted User B's portfolio.

**Our defense (3 layers working together):**

1. **Schema blocks unknown fields:** `PurchaseCreate` has NO `user_id` field. Sending it gets rejected by Pydantic with a 422 error before any service code runs.

2. **Router uses JWT, not body:** The code is `portfolio.add_purchase(db, current_user.id, data)` — `current_user.id` comes from the decoded, verified JWT. It cannot be overwritten by anything in the request.

3. **JWT is the source of truth:** The `current_user.id` is embedded in the signed token. The attacker cannot modify it without breaking the signature. So we know it's the REAL logged-in user.

**Real-world example:** In 2019, Capital One had an IDOR vulnerability where changing `accountId` in the URL showed other users' balances. Facebook has had dozens of similar bugs. The fix is always the same: never trust an ID from the request — use the authenticated user's ID from the session/token.

---

## Password Security

### Why bcrypt?

- **Deliberately slow:** Hashing takes ~0.3 seconds per password. For a login, that's nothing. For a hacker trying 1 billion passwords, that's ~10 years.
- **Salt is automatic:** Every hash includes a random 16-byte salt. Two users with the same password get different hashes. Rainbow table attacks are impossible.
- **Work factor is configurable:** bcrypt has a "rounds" parameter. More rounds = slower hashing. As computers get faster, you increase rounds to stay safe.

### What We Never Do

| Never | Why |
|-------|-----|
| Store raw passwords | Database leak = every user exposed |
| Use MD5 or SHA1 | These are designed to be fast (bad for passwords) |
| Log passwords | Logs are often less protected than the database |
| Return hashed_password in API responses | Even hashed, don't expose password data |
| Allow password reset without email verification | Account takeover risk |

---

## Token Security

### What a JWT Contains

```
Header:   {"alg": "HS256", "typ": "JWT"}
Payload:  {"sub": "abc-123", "exp": 1734567890}
Signature: HMAC-SHA256(header + "." + payload, SECRET_KEY)
```

The signature proves the payload hasn't been tampered with. If an attacker changes `sub: "abc-123"` to `sub: "xyz-999"`, the signature won't match → rejected.

### Where to Store the Token (Frontend)

| Storage | Safe? | Why |
|---------|-------|-----|
| localStorage | No | Accessible by ANY JavaScript on the page. XSS attack = stolen token. |
| httpOnly cookie | Yes | Inaccessible to JavaScript. Sent automatically with requests. More secure. |
| Memory (variable) | Yes | Lost on page refresh. Most secure but inconvenient. |

We use `Authorization: Bearer` header for Phase 2 (simpler for API testing). Phase 6+ should switch to httpOnly cookies for production.

### What Happens When SECRET_KEY Leaks

If `SECRET_KEY` leaks (accidentally committed to git, exposed in logs):
- Anyone can create valid tokens for any user
- All existing tokens become untrustworthy
- You must rotate the key immediately (invalidates ALL user sessions)

This is why `SECRET_KEY` is in `.env` (not committed to git) and must be a long random string in production (64+ characters from a cryptographically secure generator).

---

## Database Security

### UUIDs Over Auto-Increment IDs

| ID Type | Example | Guessable? |
|---------|---------|------------|
| Auto-increment | 1, 2, 3, 4... | Yes — try the next number |
| UUID | a3f2b1c4-d5e6-... | No — 2^122 possible values |

With auto-increment, an attacker can call `/users/1`, `/users/2`, `/users/3` to enumerate all users. With UUIDs, they'd need to guess a 36-character random string.

### SQL Injection Protection

We use SQLAlchemy ORM. It automatically escapes values:

```python
# This: db.query(User).filter(User.email == user_input)
# Becomes: SELECT * FROM users WHERE email = 'attacker\'s input'  (escaped)
```

If we wrote raw SQL: `f"SELECT * FROM users WHERE email = '{user_input}'"`, an attacker could send `user_input = "'; DROP TABLE users; --"` and delete the entire users table. ORMs prevent this entirely.

### Column-Level Protection

| Column | Protection |
|--------|-----------|
| `hashed_password` | Never included in API responses (schema strips it) |
| `email` | Not in Out schemas unless needed (privacy) |
| `user_id` | Always from JWT, never from request body |

---

## Defense in Depth Summary

| Layer | What | Attack Stopped |
|-------|------|---------------|
| HTTP Header | `Depends(get_current_user)` → `HTTPBearer` | No token |
| JWT Verification | `jwt.decode(token, SECRET_KEY)` | Fake/modified token |
| JWT Expiry | `"exp"` field checked automatically | Old/stolen token |
| User Exists | DB query after token decode | Deleted user's token |
| Schema Validation | `PurchaseCreate` has no `user_id` field | IDOR via request body |
| JWT as Source | `current_user.id` used, not body data | IDOR via modified payload |

---

## Interview Questions

### "Explain how you'd secure a REST API."
1. Authentication — JWT with short expiry, hashed passwords (bcrypt)
2. Authorization — every protected endpoint verifies user identity from token
3. Input validation — Pydantic schemas reject bad data before it reaches business logic
4. IDOR prevention — never trust user-supplied IDs, always use authenticated user's ID
5. SQL injection — use ORM, never raw string formatting for queries
6. HTTPS in production — encrypt all traffic

### "What's an IDOR attack and how do you prevent it?"
IDOR (Insecure Direct Object Reference) is when an attacker manipulates IDs in requests to access unauthorized data. Prevention: never use IDs from the request body/URL for authorization. Always derive the user's identity from the authenticated session/token. In our case: `current_user.id` from JWT, never `data.user_id`.

### "Why bcrypt over SHA-256 for passwords?"
SHA-256 is designed for speed (good for file checksums). bcrypt is designed to be slow (good for passwords). A GPU can try billions of SHA-256 hashes per second. bcrypt is intentionally slow (0.3s per hash) and includes automatic salting.

### "What happens if you commit SECRET_KEY to git?"
All tokens become forgeable. Rotate the key immediately (invalidates all user sessions). Use `git filter-branch` to remove it from history. Add to `.gitignore` and `.env.example`.

### "Why UUIDs and not auto-increment?"
- Unpredictable — prevents user enumeration attacks
- Globally unique — useful for distributed systems/sharding
- Can be generated client-side — no round-trip to DB for ID
- Trade-off: slightly larger storage (36 chars vs 4-byte int) and slower index performance. Acceptable for our scale.
