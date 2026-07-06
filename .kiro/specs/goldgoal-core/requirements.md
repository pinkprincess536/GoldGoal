# Requirements Document

## Introduction

GoldGoal Phase 1 (Core App) is the foundational release of the GoldGoal platform: a personal gold investment tracker that lets users record gold investments across three asset types (physical gold, gold ETFs, and Sovereign Gold Bonds), view portfolio analytics denominated in a common gold-equivalent grams unit, define ownership goals (e.g., "own 100 grams by 2035"), and track progress against those goals using both the latest available gold price and forward-looking projections. This phase delivers a secure, multi-user web application with authentication, immutable purchase records, portfolio math across mixed asset types, expanded portfolio metrics (unrealized P/L, allocation, growth), goal planning, automated market data ingestion, prediction-driven goal completion estimates, and a dashboard that composes all of the above.

Explicitly out of scope for this phase: price alerts and email notifications, historical price charting, deployment automation, PDF reports, mobile client, and asset classes beyond the three named here. Later phases will layer these on top of the entities and services defined here.

All monetary amounts are in Indian Rupees (INR). All gold quantities used in aggregate metrics are expressed in gold-equivalent grams; asset-specific quantities (grams for physical, units for ETF and SGB) are preserved on each Purchase record.

## Glossary

- **GoldGoal**: The overall platform system delivered by this specification.
- **User**: An individual with a registered GoldGoal account.
- **Auth_Service**: The GoldGoal component responsible for registration, login, session issuance, session validation, and logout.
- **Purchase_Service**: The GoldGoal component that creates, lists, and deletes Purchase records. Purchase records are append-only after creation.
- **Portfolio_Service**: The GoldGoal component that computes aggregate analytics from a User's Purchase records across all Asset_Types.
- **Goal_Service**: The GoldGoal component that creates, lists, updates, deletes, and evaluates progress against Goal records.
- **Price_Service**: The GoldGoal component that exposes the Latest_Gold_Price to other services.
- **Market_Data_Service**: The GoldGoal component that periodically fetches the latest gold price from an external source and inserts it into the Gold_Price table without modifying historical rows.
- **Prediction_Service**: The GoldGoal component that estimates a Projected_Completion_Date for each Goal using historical gold prices, forecasted future gold prices, the User's Portfolio, the User's Investment_History, and the User's Planned_Monthly_Budget.
- **Dashboard_Service**: The GoldGoal component that composes portfolio summary, active goals with progress and projection, recent purchases, and the Latest_Gold_Price into a single dashboard response.
- **Asset_Type**: The category of a Purchase, one of `PHYSICAL_GOLD`, `GOLD_ETF`, or `SOVEREIGN_GOLD_BOND`.
- **PHYSICAL_GOLD**: A Purchase Asset_Type recorded in `grams` (physical grams of gold acquired) and `price_per_gram` (INR paid per gram). Its Gold_Equivalent_Grams contribution equals its `grams` value.
- **GOLD_ETF**: A Purchase Asset_Type recorded in `units` (number of ETF units acquired), `price_per_unit` (INR paid per unit), and `grams_per_unit` (the gold-equivalent grams represented by one unit at the time of purchase, captured on the Purchase record). Its Gold_Equivalent_Grams contribution equals `units * grams_per_unit`.
- **SOVEREIGN_GOLD_BOND**: A Purchase Asset_Type recorded in `units` (number of bond units acquired) and `price_per_unit` (INR paid per unit) where one unit represents exactly one gram of gold by convention. Its Gold_Equivalent_Grams contribution equals its `units` value.
- **Purchase**: A record of a single gold investment belonging to one User, containing an Asset_Type, purchase date, asset-specific quantity and price fields, and an optional source/notes field. Once created, a Purchase's field values are immutable (see Requirement 4).
- **Purchase_Invested_Inr**: The INR amount invested in a single Purchase, computed as `grams * price_per_gram` for PHYSICAL_GOLD and `units * price_per_unit` for GOLD_ETF and SOVEREIGN_GOLD_BOND.
- **Purchase_Gold_Equivalent_Grams**: The gold-equivalent grams contribution of a single Purchase, computed as `grams` for PHYSICAL_GOLD, `units * grams_per_unit` for GOLD_ETF, and `units` for SOVEREIGN_GOLD_BOND.
- **Goal**: A User-defined target consisting of a target gold-equivalent grams value, a target date, a starting current holdings value at goal creation (in gold-equivalent grams), and a Planned_Monthly_Budget in INR.
- **Gold_Price**: A record of the price of one gram of gold in INR on a given date, as stored in the GoldGoal database.
- **Latest_Gold_Price**: The Gold_Price record with the greatest `price_date`, with ties broken by the greatest creation timestamp.
- **Session**: An authenticated association between a client and a User, represented by a session token with an expiration timestamp.
- **Password_Hash**: A one-way cryptographic hash of a User's password, produced by a hashing algorithm with a per-User random salt.
- **Total_Grams**: The sum of Purchase_Gold_Equivalent_Grams across all Purchase records owned by a User. This is the canonical aggregate holding measure and applies uniformly across Asset_Types.
- **Total_Invested**: The sum of Purchase_Invested_Inr across all Purchase records owned by a User, expressed in INR.
- **Average_Purchase_Price**: `Total_Invested / Total_Grams` when `Total_Grams > 0`, expressed in INR per gold-equivalent gram.
- **Current_Portfolio_Value**: `Total_Grams * Latest_Gold_Price.price_per_gram`, expressed in INR.
- **Unrealized_Profit_Loss_Inr**: `Current_Portfolio_Value - Total_Invested`, expressed in INR. May be negative.
- **Overall_Portfolio_Growth_Percent**: `(Current_Portfolio_Value - Total_Invested) / Total_Invested * 100` when `Total_Invested > 0`, expressed as a percentage. Undefined when `Total_Invested == 0`.
- **Asset_Allocation_Entry**: A per-Asset_Type breakdown for a User consisting of `asset_type`, `grams_equivalent` (sum of Purchase_Gold_Equivalent_Grams for that Asset_Type), `invested_inr` (sum of Purchase_Invested_Inr for that Asset_Type), `current_value_inr` (`grams_equivalent * Latest_Gold_Price.price_per_gram`), and `percent_of_portfolio` (share of Total_Invested attributable to that Asset_Type, expressed as a percentage of Total_Invested).
- **Allocation_By_Asset_Type**: The list of Asset_Allocation_Entry records covering every Asset_Type that has at least one Purchase for a User.
- **Goal_Progress_Percent**: `(User's current Total_Grams / Goal.target_grams) * 100`, clamped to the range [0, 100] for display.
- **Remaining_Grams**: `max(0, Goal.target_grams - User's current Total_Grams)`.
- **Required_Monthly_Investment**: The INR amount that would need to be invested each remaining month at the Latest_Gold_Price to reach `Goal.target_grams` by `Goal.target_date`.
- **Savings_Sufficient**: A boolean flag that is true when `Goal.monthly_budget_inr >= Required_Monthly_Investment`.
- **Planned_Monthly_Budget**: The `monthly_budget_inr` value stored on a Goal, representing the INR amount the User plans to invest each month toward that Goal.
- **Investment_History**: The chronologically ordered sequence of Purchase records owned by a User, used by the Prediction_Service to estimate future investment cadence.
- **Investment_Cadence**: The empirical rate at which a User invests, expressed in INR per month, derived from Investment_History by the Prediction_Service.
- **Forecasted_Gold_Price**: A future gold price per gram in INR, produced by an external forecasting model and consumed as read-only input by the Prediction_Service.
- **Projected_Completion_Date**: The earliest date on which the Prediction_Service estimates a User's Total_Grams will reach `Goal.target_grams`, given Investment_Cadence, Planned_Monthly_Budget, and Forecasted_Gold_Prices.
- **Projected_Completion_Confidence**: An indicator of the confidence in a Projected_Completion_Date, one of `LOW`, `MEDIUM`, or `HIGH`.
- **Projection_Status**: An indicator accompanying a projection, one of `PROJECTED` (a Projected_Completion_Date is returned), `INSUFFICIENT_HISTORY` (not enough Investment_History to project), `UNREACHABLE` (the Goal is not projected to be met within the Projection_Horizon), or `PRICE_UNAVAILABLE` (no Gold_Price or Forecasted_Gold_Price is available).
- **Projection_Horizon**: The maximum forward window over which the Prediction_Service will attempt to project a Projected_Completion_Date. It is 30 years from the current server date.
- **Fetch_Cadence**: The configurable interval at which the Market_Data_Service polls the external gold price source. Its default value is 24 hours.

## Requirements

### Requirement 1: User Registration

**User Story:** As a new visitor, I want to register an account with an email and password, so that I can maintain a private portfolio.

#### Acceptance Criteria

1. WHEN a visitor submits a registration request with a well-formed email address and a password of at least 8 characters, THE Auth_Service SHALL create a new User record with a unique identifier and return a success response.
2. THE Auth_Service SHALL store the User's password only as a Password_Hash produced by a salted, one-way password hashing algorithm.
3. IF a visitor submits a registration request with an email address that is already associated with an existing User, THEN THE Auth_Service SHALL reject the request with a conflict error and SHALL NOT create a new User record.
4. IF a visitor submits a registration request with a password shorter than 8 characters, THEN THE Auth_Service SHALL reject the request with a validation error identifying the password field.
5. IF a visitor submits a registration request with a malformed email address, THEN THE Auth_Service SHALL reject the request with a validation error identifying the email field.
6. THE Auth_Service SHALL NOT include any Password_Hash value in any response body returned to a client.

**Correctness Properties (for property-based testing):**
- For any valid email and password pair, registration followed by lookup by email SHALL return a User whose Password_Hash verifies against the original password and does not equal the original password.
- For any two registration attempts with the same email, exactly one SHALL succeed and the other SHALL return a conflict error.

### Requirement 2: User Login and Session Management

**User Story:** As a registered User, I want to log in with my email and password and stay logged in across requests, so that I can access my portfolio securely.

#### Acceptance Criteria

1. WHEN a visitor submits a login request with an email and password that match an existing User's email and Password_Hash, THE Auth_Service SHALL issue a Session token bound to that User and return the token to the client.
2. IF a visitor submits a login request with an email that is not associated with any User, THEN THE Auth_Service SHALL reject the request with an authentication error that does not disclose whether the email exists.
3. IF a visitor submits a login request with an email that matches a User but a password that does not verify against that User's Password_Hash, THEN THE Auth_Service SHALL reject the request with the same authentication error used in Requirement 2.2.
4. WHEN a client submits a request carrying a valid, non-expired Session token, THE Auth_Service SHALL identify the associated User and permit the request to proceed.
5. IF a client submits a request carrying a Session token that is expired, revoked, or not recognized, THEN THE Auth_Service SHALL reject the request with an unauthorized error.
6. WHEN a User submits a logout request with a valid Session token, THE Auth_Service SHALL revoke that Session token such that any subsequent request carrying that token is rejected with an unauthorized error.
7. THE Auth_Service SHALL set each Session token's expiration to no more than 24 hours after issuance.

**Correctness Properties:**
- For any User with credentials (email, password), login with (email, password) SHALL succeed and login with (email, password + any non-empty suffix) SHALL fail.
- After a successful logout of a Session token, any subsequent request carrying that token SHALL be rejected as unauthorized.

### Requirement 3: Add Purchase Record

**User Story:** As an authenticated User, I want to record a gold investment across physical gold, gold ETFs, or Sovereign Gold Bonds with the appropriate quantity, price, date, and notes fields for that asset type, so that my portfolio reflects my actual holdings across every form in which I hold gold.

#### Acceptance Criteria

1. WHEN an authenticated User submits a create-purchase request with `asset_type = PHYSICAL_GOLD`, a positive `grams` value, a non-negative `price_per_gram` value, a `purchase_date` that is not later than the current server date, and an optional `source_notes` string, THE Purchase_Service SHALL persist a new Purchase record owned by that User with `asset_type = PHYSICAL_GOLD` and return the created record including its identifier.
2. WHEN an authenticated User submits a create-purchase request with `asset_type = GOLD_ETF`, a positive `units` value, a non-negative `price_per_unit` value, a positive `grams_per_unit` value, a `purchase_date` that is not later than the current server date, and an optional `source_notes` string, THE Purchase_Service SHALL persist a new Purchase record owned by that User with `asset_type = GOLD_ETF` and return the created record including its identifier.
3. WHEN an authenticated User submits a create-purchase request with `asset_type = SOVEREIGN_GOLD_BOND`, a positive `units` value, a non-negative `price_per_unit` value, a `purchase_date` that is not later than the current server date, and an optional `source_notes` string, THE Purchase_Service SHALL persist a new Purchase record owned by that User with `asset_type = SOVEREIGN_GOLD_BOND` and return the created record including its identifier.
4. IF an authenticated User submits a create-purchase request with an `asset_type` value that is not one of `PHYSICAL_GOLD`, `GOLD_ETF`, or `SOVEREIGN_GOLD_BOND`, THEN THE Purchase_Service SHALL reject the request with a validation error identifying the `asset_type` field.
5. IF an authenticated User submits a create-purchase request whose asset-specific quantity field (`grams` for PHYSICAL_GOLD, `units` for GOLD_ETF and SOVEREIGN_GOLD_BOND) is less than or equal to zero, THEN THE Purchase_Service SHALL reject the request with a validation error identifying that quantity field.
6. IF an authenticated User submits a create-purchase request whose asset-specific price field (`price_per_gram` for PHYSICAL_GOLD, `price_per_unit` for GOLD_ETF and SOVEREIGN_GOLD_BOND) is less than zero, THEN THE Purchase_Service SHALL reject the request with a validation error identifying that price field.
7. IF an authenticated User submits a create-purchase request with `asset_type = GOLD_ETF` and a `grams_per_unit` value that is less than or equal to zero or is omitted, THEN THE Purchase_Service SHALL reject the request with a validation error identifying the `grams_per_unit` field.
8. IF an authenticated User submits a create-purchase request with a `purchase_date` that is later than the current server date, THEN THE Purchase_Service SHALL reject the request with a validation error identifying the `purchase_date` field.
9. WHERE the `source_notes` field is provided, THE Purchase_Service SHALL persist the value truncated to at most 500 characters and reject any longer value with a validation error identifying the `source_notes` field.
10. THE Purchase_Service SHALL associate every created Purchase record with the User identified by the submitting Session and SHALL NOT permit that association to be overridden by request input.
11. IF an authenticated User submits a create-purchase request that includes fields not applicable to the specified `asset_type` (for example, a `grams_per_unit` field on a PHYSICAL_GOLD purchase or a `grams` field on a GOLD_ETF purchase), THEN THE Purchase_Service SHALL reject the request with a validation error identifying the first inapplicable field encountered.

**Correctness Properties (for property-based testing):**
- For any accepted create-purchase request, subsequently fetching the returned identifier SHALL return a Purchase record whose `asset_type` and asset-specific fields equal the submitted values.
- For any create-purchase request that is rejected, no new Purchase record SHALL exist for the User after the request completes.
- For any accepted Purchase, its Purchase_Gold_Equivalent_Grams SHALL equal `grams` when `asset_type = PHYSICAL_GOLD`, `units * grams_per_unit` when `asset_type = GOLD_ETF`, and `units` when `asset_type = SOVEREIGN_GOLD_BOND`.
- For any accepted Purchase, its Purchase_Invested_Inr SHALL equal `grams * price_per_gram` when `asset_type = PHYSICAL_GOLD` and `units * price_per_unit` otherwise.

### Requirement 4: List and Delete Purchase Records; Purchase Immutability

**User Story:** As an authenticated User, I want to view my purchase records and delete individual records I no longer want to keep, while trusting that no field on a saved Purchase can be edited after creation, so that my investment history remains an accurate, tamper-evident record.

#### Acceptance Criteria

1. WHEN an authenticated User submits a list-purchases request, THE Purchase_Service SHALL return all Purchase records owned by that User, sorted by `purchase_date` descending with ties broken by creation timestamp descending.
2. THE Purchase_Service SHALL treat every Purchase record as append-only after creation and SHALL NOT expose any operation that modifies the value of any persisted field on an existing Purchase record.
3. IF an authenticated User submits any request that attempts to modify a persisted field of an existing Purchase record, THEN THE Purchase_Service SHALL reject the request with a validation error indicating that Purchase records are immutable and SHALL NOT modify the record.
4. WHEN an authenticated User submits a delete-purchase request for a Purchase record they own, THE Purchase_Service SHALL remove the record and return a success response.
5. IF an authenticated User submits a delete-purchase request for a Purchase record identifier that does not exist or is owned by a different User, THEN THE Purchase_Service SHALL reject the request with a not-found error and SHALL NOT modify any record.

**Correctness Properties:**
- For any accepted create followed by any sequence of authenticated non-delete requests targeting a Purchase record, the record's field values SHALL remain byte-identical to the values persisted at creation time.
- For any sequence of accepted create and delete operations for a User, the set of records returned by list-purchases SHALL equal the set of created-and-not-deleted records ordered by `(purchase_date DESC, created_at DESC)`.
- List-purchases for User A SHALL never return a Purchase record owned by User B.

### Requirement 5: Portfolio Analytics

**User Story:** As an authenticated User, I want to see my total gold-equivalent grams, total invested INR, average purchase price, current portfolio value, unrealized profit or loss, allocation across asset types, and overall portfolio growth percentage, so that I can understand my position both in aggregate and by asset type.

#### Acceptance Criteria

1. WHEN an authenticated User submits a portfolio-summary request, THE Portfolio_Service SHALL return `total_grams` equal to the sum of Purchase_Gold_Equivalent_Grams across every Purchase record owned by that User.
2. WHEN an authenticated User submits a portfolio-summary request, THE Portfolio_Service SHALL return `total_invested` equal to the sum of Purchase_Invested_Inr across every Purchase record owned by that User, expressed in INR.
3. WHEN an authenticated User submits a portfolio-summary request and `total_grams > 0`, THE Portfolio_Service SHALL return `average_purchase_price` equal to `total_invested / total_grams`, expressed in INR per gold-equivalent gram.
4. IF an authenticated User submits a portfolio-summary request and `total_grams == 0`, THEN THE Portfolio_Service SHALL return `average_purchase_price` as null and SHALL return `total_invested` as 0 and `total_grams` as 0.
5. WHEN an authenticated User submits a portfolio-summary request and at least one Gold_Price record exists, THE Portfolio_Service SHALL return `current_portfolio_value` equal to `total_grams * Latest_Gold_Price.price_per_gram`, expressed in INR.
6. IF an authenticated User submits a portfolio-summary request and no Gold_Price record exists in the database, THEN THE Portfolio_Service SHALL return `current_portfolio_value` as null along with an indicator that price data is unavailable.
7. WHEN an authenticated User submits a portfolio-summary request and `current_portfolio_value` is non-null, THE Portfolio_Service SHALL return `unrealized_profit_loss_inr` equal to `current_portfolio_value - total_invested`.
8. IF an authenticated User submits a portfolio-summary request and `current_portfolio_value` is null, THEN THE Portfolio_Service SHALL return `unrealized_profit_loss_inr` as null.
9. WHEN an authenticated User submits a portfolio-summary request and `total_invested > 0` and `current_portfolio_value` is non-null, THE Portfolio_Service SHALL return `overall_portfolio_growth_percent` equal to `((current_portfolio_value - total_invested) / total_invested) * 100`, expressed as a percentage.
10. IF an authenticated User submits a portfolio-summary request and either `total_invested == 0` or `current_portfolio_value` is null, THEN THE Portfolio_Service SHALL return `overall_portfolio_growth_percent` as null.
11. WHEN an authenticated User submits a portfolio-summary request, THE Portfolio_Service SHALL return `allocation_by_asset_type` as a list containing one Asset_Allocation_Entry per Asset_Type that has at least one Purchase record owned by that User.
12. WHEN an authenticated User submits a portfolio-summary request and `current_portfolio_value` is null, THE Portfolio_Service SHALL return each Asset_Allocation_Entry's `current_value_inr` as null.
13. WHEN an authenticated User submits a portfolio-summary request and `total_invested > 0`, THE Portfolio_Service SHALL return each Asset_Allocation_Entry's `percent_of_portfolio` equal to `(entry.invested_inr / total_invested) * 100`.
14. IF an authenticated User submits a portfolio-summary request and `total_invested == 0`, THEN THE Portfolio_Service SHALL return `allocation_by_asset_type` as an empty list.
15. THE Portfolio_Service SHALL round all returned monetary values to two decimal places, all returned gram values to four decimal places, and all returned percentage values to two decimal places for display.

**Correctness Properties:**
- For any User, `total_grams` SHALL equal the sum of Purchase_Gold_Equivalent_Grams across that User's Purchase records within rounding tolerance.
- For any User with `total_grams > 0`, `total_invested` SHALL equal `average_purchase_price * total_grams` within rounding tolerance.
- Adding a Purchase whose Purchase_Gold_Equivalent_Grams is `g` and Purchase_Invested_Inr is `v` SHALL increase `total_grams` by exactly `g` and `total_invested` by exactly `v` within rounding tolerance.
- Deleting a Purchase SHALL decrease `total_grams` and `total_invested` by exactly the amounts that Purchase contributed within rounding tolerance.
- For any User with at least one Gold_Price present, `current_portfolio_value` SHALL equal `total_grams * Latest_Gold_Price.price_per_gram` within rounding tolerance.
- For any User with a non-null `current_portfolio_value`, `unrealized_profit_loss_inr` SHALL equal `current_portfolio_value - total_invested` within rounding tolerance.
- For any User with `total_invested > 0` and non-null `current_portfolio_value`, `overall_portfolio_growth_percent` SHALL equal `(unrealized_profit_loss_inr / total_invested) * 100` within rounding tolerance.
- For any User, the sum of `grams_equivalent` across every Asset_Allocation_Entry SHALL equal `total_grams` within rounding tolerance.
- For any User, the sum of `invested_inr` across every Asset_Allocation_Entry SHALL equal `total_invested` within rounding tolerance.
- For any User with `total_invested > 0`, the sum of `percent_of_portfolio` across every Asset_Allocation_Entry SHALL equal 100 within rounding tolerance.

### Requirement 6: Create and Manage Goals

**User Story:** As an authenticated User, I want to create a gold ownership goal with a target gold-equivalent grams amount, target date, current holdings, and monthly budget, so that I can plan my long-term accumulation across every asset type I hold.

#### Acceptance Criteria

1. WHEN an authenticated User submits a create-goal request with `target_grams > 0`, a `target_date` strictly later than the current server date, `current_holdings_grams >= 0`, and `monthly_budget_inr >= 0`, THE Goal_Service SHALL persist a new Goal record owned by that User with `target_grams` interpreted as gold-equivalent grams and return the created record including its identifier.
2. IF an authenticated User submits a create-goal request with `target_grams <= 0`, THEN THE Goal_Service SHALL reject the request with a validation error identifying the `target_grams` field.
3. IF an authenticated User submits a create-goal request with a `target_date` that is not strictly later than the current server date, THEN THE Goal_Service SHALL reject the request with a validation error identifying the `target_date` field.
4. IF an authenticated User submits a create-goal request with `current_holdings_grams < 0` or `monthly_budget_inr < 0`, THEN THE Goal_Service SHALL reject the request with a validation error identifying the offending field.
5. WHEN an authenticated User submits a list-goals request, THE Goal_Service SHALL return all Goal records owned by that User.
6. WHEN an authenticated User submits an update-goal request for a Goal they own with values that satisfy the validation rules in Requirements 6.1 through 6.4, THE Goal_Service SHALL update the record with the submitted values and return the updated record.
7. WHEN an authenticated User submits a delete-goal request for a Goal they own, THE Goal_Service SHALL remove the record and return a success response.
8. IF an authenticated User submits an update-goal or delete-goal request for a Goal identifier that does not exist or is owned by a different User, THEN THE Goal_Service SHALL reject the request with a not-found error and SHALL NOT modify any record.

### Requirement 7: Goal Progress Tracking

**User Story:** As an authenticated User, I want to see my progress toward each goal, remaining grams needed, whether my monthly budget is sufficient at current prices, and when the platform projects I will actually reach the goal, so that I can adjust my savings plan.

#### Acceptance Criteria

1. WHEN an authenticated User submits a goal-progress request for a Goal they own, THE Goal_Service SHALL return `current_grams` equal to that User's current `total_grams` as computed by the Portfolio_Service.
2. WHEN an authenticated User submits a goal-progress request for a Goal they own, THE Goal_Service SHALL return `progress_percent` equal to `min(100, max(0, (current_grams / target_grams) * 100))`.
3. WHEN an authenticated User submits a goal-progress request for a Goal they own, THE Goal_Service SHALL return `remaining_grams` equal to `max(0, target_grams - current_grams)`.
4. WHEN an authenticated User submits a goal-progress request for a Goal they own and the current server date is strictly earlier than `target_date` and a Latest_Gold_Price exists, THE Goal_Service SHALL return `required_monthly_investment_inr` equal to `(remaining_grams * Latest_Gold_Price.price_per_gram) / months_remaining`, where `months_remaining` is the number of whole calendar months from the current server date up to and including the month of `target_date` and is at least 1.
5. WHEN an authenticated User submits a goal-progress request for a Goal they own and the Goal_Service has returned `required_monthly_investment_inr`, THE Goal_Service SHALL return `savings_sufficient` as true if and only if `monthly_budget_inr >= required_monthly_investment_inr`.
6. IF an authenticated User submits a goal-progress request for a Goal they own and `current_grams >= target_grams`, THEN THE Goal_Service SHALL return `progress_percent` as 100, `remaining_grams` as 0, `required_monthly_investment_inr` as 0, and `savings_sufficient` as true.
7. IF an authenticated User submits a goal-progress request for a Goal they own and the current server date is on or after `target_date`, THEN THE Goal_Service SHALL return `required_monthly_investment_inr` as null and `savings_sufficient` as false whenever `remaining_grams > 0`.
8. IF an authenticated User submits a goal-progress request for a Goal they own and no Gold_Price record exists, THEN THE Goal_Service SHALL return `required_monthly_investment_inr` as null and `savings_sufficient` as null with an indicator that price data is unavailable.
9. WHEN an authenticated User submits a goal-progress request for a Goal they own, THE Goal_Service SHALL return `projected_completion_date` and `projected_completion_confidence` fields obtained from the Prediction_Service as defined in Requirement 13, along with a `projection_status` field carrying the associated Projection_Status value.

**Correctness Properties:**
- For any Goal with `target_grams > 0`, `progress_percent` SHALL lie in the closed interval [0, 100].
- For any Goal, `remaining_grams` SHALL be greater than or equal to 0.
- For any Goal with `current_grams >= target_grams`, `remaining_grams` SHALL equal 0 and `progress_percent` SHALL equal 100.
- Adding a Purchase whose Purchase_Gold_Equivalent_Grams is `g` SHALL either decrease `remaining_grams` by exactly `g` or, if `g` exceeds the previous `remaining_grams`, drive `remaining_grams` to 0.
- When `required_monthly_investment_inr` is non-null, `remaining_grams * Latest_Gold_Price.price_per_gram` SHALL equal `required_monthly_investment_inr * months_remaining` within rounding tolerance.
- `savings_sufficient` SHALL be true if and only if `monthly_budget_inr >= required_monthly_investment_inr` whenever both values are non-null.

### Requirement 8: Latest Gold Price Display

**User Story:** As an authenticated User, I want to see the latest recorded gold price per gram, so that I can interpret my portfolio value in current market terms.

#### Acceptance Criteria

1. WHEN an authenticated User submits a latest-price request and at least one Gold_Price record exists, THE Price_Service SHALL return the `price_per_gram` in INR and the `price_date` of the Gold_Price record with the most recent `price_date`.
2. IF an authenticated User submits a latest-price request and no Gold_Price record exists, THEN THE Price_Service SHALL return an empty result with an indicator that price data is unavailable.
3. IF two or more Gold_Price records share the most recent `price_date`, THEN THE Price_Service SHALL return the one with the greatest creation timestamp.

### Requirement 9: Dashboard Aggregation

**User Story:** As an authenticated User, I want a single dashboard view showing my expanded portfolio summary, active goals with progress and projections, recent purchases, and the latest gold price, so that I can assess my position at a glance.

#### Acceptance Criteria

1. WHEN an authenticated User submits a dashboard request, THE Dashboard_Service SHALL return a portfolio summary equal to the response defined in Requirement 5 for that User, including `total_grams`, `total_invested`, `average_purchase_price`, `current_portfolio_value`, `unrealized_profit_loss_inr`, `overall_portfolio_growth_percent`, and `allocation_by_asset_type`.
2. WHEN an authenticated User submits a dashboard request, THE Dashboard_Service SHALL return a list of all Goal records owned by that User, each with the progress fields defined in Requirement 7, including `projected_completion_date`, `projected_completion_confidence`, and `projection_status`.
3. WHEN an authenticated User submits a dashboard request, THE Dashboard_Service SHALL return the five most recent Purchase records owned by that User, sorted by `purchase_date` descending with ties broken by creation timestamp descending, each Purchase carrying its `asset_type` and its asset-specific quantity and price fields.
4. WHEN an authenticated User submits a dashboard request, THE Dashboard_Service SHALL return the latest gold price data as defined in Requirement 8.
5. THE Dashboard_Service SHALL return a coherent snapshot in which the `total_grams` used in the portfolio summary equals the `current_grams` used in every returned Goal progress entry.
6. THE Dashboard_Service SHALL return a coherent snapshot in which the `Latest_Gold_Price` referenced by the portfolio summary, by every Goal's `required_monthly_investment_inr`, and by the latest-price section is identical.

### Requirement 10: Multi-User Data Isolation

**User Story:** As an authenticated User, I want assurance that only I can see and modify my purchases and goals, so that my financial data stays private.

#### Acceptance Criteria

1. THE Purchase_Service SHALL restrict every list, read, and delete operation to Purchase records whose owner matches the User identified by the request's Session.
2. THE Goal_Service SHALL restrict every list, read, update, and delete operation to Goal records whose owner matches the User identified by the request's Session.
3. THE Portfolio_Service SHALL compute analytics only from Purchase records whose owner matches the User identified by the request's Session.
4. THE Dashboard_Service SHALL compose responses only from data whose owner matches the User identified by the request's Session.
5. THE Prediction_Service SHALL compute projections only from Purchase and Goal records whose owner matches the User identified by the request's Session, and SHALL treat Gold_Price and Forecasted_Gold_Price data as shared read-only inputs across all Users.
6. IF a request that requires authentication is submitted without a valid Session, THEN GoldGoal SHALL reject the request with an unauthorized error and SHALL NOT return any User-owned data.

**Correctness Properties:**
- For any pair of distinct Users A and B and any sequence of authenticated requests by A, the responses returned to A SHALL contain no Purchase or Goal record owned by B.
- For any authenticated request by User A that attempts to read or delete a Purchase record or to read, update, or delete a Goal record owned by User B, the response SHALL be a not-found or unauthorized error and the record SHALL remain unchanged.

### Requirement 11: Dashboard Load Performance

**User Story:** As an authenticated User, I want the dashboard to load quickly, so that I can review my portfolio without waiting.

#### Acceptance Criteria

1. WHEN an authenticated User with up to 1,000 Purchase records and up to 10 Goal records submits a dashboard request under nominal single-instance load, THE Dashboard_Service SHALL return a response within 1,000 milliseconds measured at the server boundary in at least 95 percent of measured requests.
2. WHEN an authenticated User submits a portfolio-summary or goal-progress request under the same conditions as Requirement 11.1, THE Portfolio_Service and Goal_Service SHALL each return a response within 500 milliseconds at the server boundary in at least 95 percent of measured requests.

### Requirement 12: Automated Market Data Ingestion

**User Story:** As a User of GoldGoal, I want the platform to keep the gold price database up to date automatically, so that my portfolio value and goal calculations reflect current market conditions without any manual step on my part.

#### Acceptance Criteria

1. THE Market_Data_Service SHALL fetch the latest gold price per gram in INR from an external source on a schedule whose interval is the configured Fetch_Cadence, with a default Fetch_Cadence of 24 hours.
2. WHEN the Market_Data_Service successfully fetches a gold price for a `price_date` for which no Gold_Price record exists, THE Market_Data_Service SHALL insert a new Gold_Price record with that `price_date`, `price_per_gram`, and a server-set creation timestamp.
3. IF the Market_Data_Service fetches a gold price for a `price_date` for which a Gold_Price record already exists, THEN THE Market_Data_Service SHALL NOT insert a duplicate row and SHALL NOT modify the existing Gold_Price record.
4. THE Market_Data_Service SHALL NOT modify or delete any Gold_Price record that already exists in the database.
5. IF an external gold price fetch fails, THEN THE Market_Data_Service SHALL retry the fetch up to a configured maximum retry count using exponential backoff between attempts and SHALL record the final failure without raising an unhandled error to the rest of the application.
6. IF all fetch attempts for a scheduled tick fail, THEN THE Market_Data_Service SHALL leave the existing Gold_Price rows unchanged, and the Price_Service SHALL continue to return the Latest_Gold_Price computed from the existing rows as defined in Requirement 8.
7. WHEN the GoldGoal application starts and the `gold_prices` table is empty, THE Market_Data_Service SHALL bootstrap the table by inserting one Gold_Price record per row in `data/gold.csv` before any scheduled fetch runs.
8. WHEN the GoldGoal application starts and the `gold_prices` table is non-empty, THE Market_Data_Service SHALL NOT re-run the CSV bootstrap and SHALL rely on the scheduled fetch path for all subsequent price updates.

**Correctness Properties:**
- For any Gold_Price record present in the database at time `t`, that record's `price_date`, `price_per_gram`, and creation timestamp SHALL be byte-identical at every time `t' > t`, provided no manual database intervention occurred.
- For any sequence of scheduled fetches that produce the same `(price_date, price_per_gram)` payload one or more times, exactly one Gold_Price record SHALL exist for that `price_date` after each fetch completes.
- For any scheduled fetch tick, the Market_Data_Service SHALL either insert exactly one new Gold_Price row keyed by a new `price_date` or leave the `gold_prices` table unchanged.

### Requirement 13: Prediction-Driven Goal Completion Date

**User Story:** As an authenticated User, I want the platform to estimate when I am likely to reach each of my goals based on my current portfolio, my investment history, my planned monthly budget, and forecasted gold prices, so that I know whether my current plan is on track before the target date arrives.

#### Acceptance Criteria

1. WHEN an authenticated User submits a goal-progress request for a Goal they own and the Prediction_Service has sufficient inputs to project, THE Prediction_Service SHALL return a `projected_completion_date` equal to the earliest date on which the User's Total_Grams is estimated to reach `target_grams` given the User's Investment_Cadence, `monthly_budget_inr`, existing Total_Grams, and Forecasted_Gold_Prices.
2. WHEN the Prediction_Service returns a `projected_completion_date`, THE Prediction_Service SHALL also return a `projected_completion_confidence` value of `LOW`, `MEDIUM`, or `HIGH`, and SHALL return `projection_status = PROJECTED`.
3. IF the User's Investment_History does not contain enough Purchase records to derive an Investment_Cadence, THEN THE Prediction_Service SHALL return `projected_completion_date` as null, `projected_completion_confidence` as null, and `projection_status = INSUFFICIENT_HISTORY`.
4. IF the User's current Total_Grams is already greater than or equal to `target_grams`, THEN THE Prediction_Service SHALL return `projected_completion_date` equal to the current server date, `projected_completion_confidence = HIGH`, and `projection_status = PROJECTED`.
5. IF no Gold_Price record and no Forecasted_Gold_Price is available, THEN THE Prediction_Service SHALL return `projected_completion_date` as null, `projected_completion_confidence` as null, and `projection_status = PRICE_UNAVAILABLE`.
6. IF the Prediction_Service is unable to project a completion date within the Projection_Horizon of 30 years from the current server date, THEN THE Prediction_Service SHALL return `projected_completion_date` as null, `projected_completion_confidence` as null, and `projection_status = UNREACHABLE`.
7. WHEN the Prediction_Service returns a non-null `projected_completion_date`, THE Prediction_Service SHALL return a date that is on or after the current server date and on or before the last day of the Projection_Horizon.
8. WHEN the Prediction_Service returns a non-null `projected_completion_date` and Investment_Cadence and Planned_Monthly_Budget together imply zero net additional accumulation per month, THE Prediction_Service SHALL return `projection_status = UNREACHABLE` and `projected_completion_date` as null.

**Correctness Properties:**
- For any Goal on which `projection_status = PROJECTED` is returned, `projected_completion_date` SHALL be non-null and `projected_completion_confidence` SHALL be one of `LOW`, `MEDIUM`, or `HIGH`.
- For any Goal on which `projection_status` is not `PROJECTED`, `projected_completion_date` SHALL be null and `projected_completion_confidence` SHALL be null.
- For any Goal on which `projection_status = PROJECTED` is returned, `projected_completion_date` SHALL lie in the closed interval `[current_server_date, current_server_date + 30 years]`.
- For any two consecutive goal-progress requests for the same Goal in which no new Purchase, no new Goal update, and no new Gold_Price or Forecasted_Gold_Price has been persisted between them, `projected_completion_date`, `projected_completion_confidence`, and `projection_status` SHALL be identical across the two responses.
- For any Goal where the User's Total_Grams already meets or exceeds `target_grams`, `projection_status` SHALL equal `PROJECTED` and `projected_completion_date` SHALL equal the current server date.
