# API Documentation

Base URL: `/api/v1`

All protected endpoints require an `Authorization: Bearer <token>` header.

## Authentication
- `POST /auth/login`
  - Body: `{ "username": "admin", "password": "password" }`
  - Returns: `{ "status": "success", "data": { "token": "...", "user": {...} } }`

## Inventory
- `GET /inventory/products`
  - Returns array of products and services.
- `POST /inventory/products` (Requires Admin)
  - Body: `{ "name": "...", "categoryId": "...", "sku": "...", "unitPrice": 1000, "isService": false }`

## Sales
- `GET /sales`
  - Returns all completed sales with items and payments.
- `POST /sales`
  - Body: `{ "invoiceNumber": "INV-123", "subtotal": 1000, "discount": 0, "total": 1000, "items": [...], "payments": [...] }`

## Services
- `GET /services/categories`
- `POST /services/categories`
- `POST /services/transactions` (Logs a specific service execution)

## Expenses
- `GET /expenses`
- `POST /expenses`
- `PATCH /expenses/:id/approve` (Requires Admin)

## Accounting
- `GET /accounts`
- `GET /accounts/ledger`
- `POST /accounts/journal` (Creates a double-entry journal)
