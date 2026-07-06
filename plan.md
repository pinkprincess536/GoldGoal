# GoldGoal: Gold Investment Goal Tracker & Planning Platform

## Project Vision

This project transforms a traditional gold price prediction model into a production-style financial planning platform. It helps users track their gold investments, monitor progress toward long-term ownership goals, and use price forecasts to estimate future costs.

The application **does not provide financial advice**; instead, it provides planning tools, portfolio analytics, and scenario-based projections.

---

## Problem Statement

People who invest in physical gold or Gold ETFs often maintain records across invoices, spreadsheets, or memory. They struggle to understand:

- Total gold owned
- Total money invested
- Average purchase price
- Current portfolio value
- Progress toward a long-term ownership goal
- How future price movements could affect the cost of achieving that goal

---

## Target Users

- Individuals investing in physical gold
- Gold ETF investors
- Long-term wealth planners
- Users saving toward future financial goals using gold as an asset

---

## Objectives

1. Track every gold purchase
2. Display real-time portfolio analytics
3. Allow users to define ownership goals (e.g., 100g by 2035)
4. Estimate future costs using historical data and ML forecasts
5. Automate market data ingestion
6. Deploy the application using modern DevOps practices

---

## Core Features

- User authentication
- Portfolio management
- Purchase history
- Goal creation and tracking
- Daily gold price updates
- Historical charts
- ML-based price prediction widget
- Price alerts
- Dashboard with profit/loss and analytics

---

## Goal Planning

**Users specify:**
- Target grams
- Target date
- Current holdings
- Monthly investment budget

**The platform calculates:**
- Current progress
- Remaining grams
- Estimated future cost
- Projected holdings under different forecast scenarios
- Whether the current savings rate is sufficient

---

## Prediction Philosophy

The ML model is **not used to recommend buying or selling**. It is used to:

- Estimate possible future costs
- Update long-term planning projections
- Compare current assumptions with forecast scenarios
- Improve planning rather than provide financial advice

---

## High-Level Architecture

```
User → Nginx (reverse proxy + SSL) → FastAPI + Streamlit (Docker containers)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
              Lambda (alerts)      EC2 (app host)       EventBridge (cron)
                    │                     │                     │
              SNS + SES            RDS (PostgreSQL)      Lambda (price fetcher)
                    │                     │                     │
              Users notified        S3 (reports/plots)    S3 (prediction outputs)
```

## AWS Services

| Service | Purpose |
|---------|---------|
| **EC2** | Run Docker Compose (FastAPI + Streamlit + Nginx + Prometheus + Grafana) |
| **RDS** | Managed PostgreSQL (users, purchases, goals, prices) |
| **S3** | Store prediction outputs, CSV reports, Terraform state |
| **Lambda** | Price ingestion (daily gold price fetch), goal alerts |
| **EventBridge** | Trigger Lambda on schedule (daily + weekly) |
| **SNS + SES** | Price alerts, goal milestone notifications |
| **CloudWatch** | Logs, alarms, Lambda monitoring |

## DevOps Stack (Learning Tools)

| Tool | Role |
|------|------|
| **Docker Compose** | Local dev — FastAPI, Streamlit, PostgreSQL, Prometheus, Grafana |
| **Nginx** | Reverse proxy — route to FastAPI + Streamlit, serve HTTPS |
| **Terraform** | IaC — provision EC2, RDS, S3, Lambda, EventBridge, IAM |
| **Prometheus** | Collect metrics from FastAPI, Nginx, EC2 |
| **Grafana** | Dashboards — API latency, portfolio activity, prediction accuracy |
| **CloudWatch** | Centralized logging from Lambda + EC2 |

---

## Database Entities

- Users
- Purchases
- Goals
- Gold Prices
- Predictions
- Alerts
- Notification History

---

## User Workflow

1. Register / Login
2. Add gold purchases
3. Create a gold ownership goal
4. System automatically fetches daily prices
5. Portfolio value updates automatically
6. Forecast service estimates future costs
7. Dashboard displays progress
8. Alerts notify users about important events

---

## Development Phases

### Phase 1: Project Scaffold & Docker Compose
- Directory structure, `.env`, `requirements.txt`
- FastAPI skeleton with health check
- PostgreSQL via Docker Compose
- Streamlit skeleton
- Docker Compose tying it all together

### Phase 2: Database & Auth
- SQLAlchemy models (Users, Purchases, Goals, Prices, Predictions, Alerts)
- Alembic migrations
- JWT-based signup/login
- Seeded test users + mock purchases

### Phase 3: Portfolio Service
- CRUD for gold purchases
- Portfolio analytics (total grams, total invested, avg price, current value, P&L)
- Live price integration (daily fetch via external API → store in `gold_prices` table)

### Phase 4: Goals & ML Prediction
- Goal CRUD (target grams, target date, monthly budget)
- Progress engine (acquired vs remaining, completion %, cost estimate)
- Integrate existing ML pipeline → estimate goal completion date
- Dashboard API aggregating portfolio + goals + projections

### Phase 5: Automation & Alerts
- EventBridge cron → triggers Lambda to fetch daily prices
- SNS/SES for price alert thresholds + goal milestones
- Lambda for scheduled prediction retraining

### Phase 6: DevOps & Monitoring
- Nginx reverse proxy (route to FastAPI + Streamlit)
- Prometheus metrics (request latency, portfolio queries, prediction calls)
- Grafana dashboards (API health, user activity, prediction accuracy)

### Phase 7: Infrastructure as Code
- Terraform scripts for RDS, S3, Lambda, EventBridge, IAM, EC2
- Remote state (S3 backend)

### Phase 8: Production Deployment
- GitHub Actions CI/CD (lint, test, build Docker image → push to ECR)
- Deploy to EC2 via Terraform
- CloudWatch alarms
- Final integration test

---

## Future Enhancements

- Gold ETF support
- Silver support
- PDF investment reports
- Monthly email summaries
- Natural-language assistant for querying personal portfolio
- Mobile application

---

## Interview Pitch

GoldGoal is a production-oriented financial planning platform that helps users track gold investments and achieve long-term ownership goals. It combines portfolio management, automated market data ingestion, machine learning-based forecasting, and modern DevOps practices including containerization, CI/CD, cloud deployment, and monitoring.

---

## End-to-End User Flow

When a user first visits GoldGoal, they create an account or log in securely. After authentication, they are taken to a personalized dashboard where they can create one or more gold ownership goals, such as saving for a wedding, retirement, or any other milestone. Each goal specifies the target quantity of gold, the desired completion date, and optionally a planned monthly investment amount.

Once a goal has been created, the user manually records every gold investment they make, whether it is physical gold, a Gold ETF, or a Sovereign Gold Bond. For each investment, the application stores the purchase details permanently, including the purchase date, quantity or units, and purchase price. These records are never modified, ensuring an accurate history of the user's investment journey.

Behind the scenes, GoldGoal continuously maintains an independent market database by periodically fetching the latest gold prices and other relevant market information. This live market data is stored separately from the user's purchase history so that historical investments remain unchanged while the current portfolio valuation is always calculated using the latest available prices. The dashboard combines these two datasets to display important financial metrics such as total holdings, average buying price, current portfolio value, unrealized profit or loss, investment allocation across different asset types, and overall portfolio growth.

Whenever the portfolio or market prices change, the Goal Engine recalculates the user's progress toward each goal. Instead of simply showing the current portfolio value, GoldGoal determines how much gold has already been accumulated, how much remains to be acquired, the estimated cost required to complete each goal based on current market conditions, and the overall completion percentage.

The application's prediction model then uses historical gold prices, predicted future prices, the user's existing portfolio, investment history, and planned investment pattern to estimate when each goal is likely to be achieved. Rather than only forecasting future gold prices, the model answers a more meaningful question for the user: **"Based on my current investments and expected market conditions, when am I likely to achieve my gold ownership goal?"**

The dashboard serves as the central place where users can monitor all of this information in real time. They can view their current holdings, compare their average buying price with the latest market price, track progress across multiple goals simultaneously, and see projected goal completion dates generated by the prediction model. Throughout this process, the system automatically handles market data updates, portfolio recalculations, and prediction generation in the background, allowing users to focus entirely on planning and achieving their long-term gold ownership goals.
