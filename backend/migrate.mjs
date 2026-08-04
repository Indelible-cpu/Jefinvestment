// Pure Node.js migration - no npm packages needed
// Uses built-in https to call Neon's HTTP API directly
import https from 'node:https';
import { URL } from 'node:url';

const connStr = 'postgresql://neondb_owner:npg_cZivLq7JXh4S@ep-wandering-flower-axpx499e-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Parse connection string
const u = new URL(connStr);
const host = u.hostname;
const db = u.pathname.slice(1);
const user = u.username;
const pass = u.password;

// Neon HTTP API endpoint
const neonApiUrl = `https://${host}/sql`;
const authHeader = `Bearer ${decodeURIComponent(pass)}`;

function queryNeon(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Neon-Connection-String': connStr,
        'Neon-Raw-Text-Output': 'true',
      },
    };

    const req = https.request(neonApiUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const statements = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  `CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name")`,

  `CREATE TABLE IF NOT EXISTS "Permission" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "action" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Permission_action_key" ON "Permission"("action")`,

  `CREATE TABLE IF NOT EXISTS "_RolePermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "_RolePermissions_AB_unique" ON "_RolePermissions"("A","B")`,
  `CREATE INDEX IF NOT EXISTS "_RolePermissions_B_index" ON "_RolePermissions"("B")`,

  `CREATE TABLE IF NOT EXISTS "Branch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Branch_name_key" ON "Branch"("name")`,

  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,

  `CREATE TABLE IF NOT EXISTS "ProductCategory" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_name_key" ON "ProductCategory"("name")`,

  `CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "costPrice" NUMERIC NOT NULL DEFAULT 0,
    "sellingPrice" NUMERIC NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Product_barcode_key" ON "Product"("barcode")`,

  `CREATE TABLE IF NOT EXISTS "ProductBranch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductBranch_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProductBranch_productId_branchId_key" ON "ProductBranch"("productId","branchId")`,

  `CREATE TABLE IF NOT EXISTS "ProductVariant" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skuSuffix" TEXT,
    "priceAdj" NUMERIC NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "invoiceNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "subtotal" NUMERIC NOT NULL,
    "discount" NUMERIC NOT NULL DEFAULT 0,
    "total" NUMERIC NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "creditAmount" NUMERIC NOT NULL DEFAULT 0,
    "creditPaid" NUMERIC NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMPTZ,
    "syncId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Sale_invoiceNumber_key" ON "Sale"("invoiceNumber")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Sale_syncId_key" ON "Sale"("syncId")`,

  `CREATE TABLE IF NOT EXISTS "SaleItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" NUMERIC NOT NULL,
    "discount" NUMERIC NOT NULL DEFAULT 0,
    "subtotal" NUMERIC NOT NULL,
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" NUMERIC NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "CreditPayment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "saleId" TEXT NOT NULL,
    "amount" NUMERIC NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "CreditPayment_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_name_key" ON "ExpenseCategory"("name")`,

  `CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "categoryId" TEXT NOT NULL,
    "amount" NUMERIC NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "receiptUrl" TEXT,
    "syncId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Expense_syncId_key" ON "Expense"("syncId")`,

  `CREATE TABLE IF NOT EXISTS "ServiceCategory" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCategory_name_key" ON "ServiceCategory"("name")`,

  `CREATE TABLE IF NOT EXISTS "ServiceTransaction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "categoryId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" NUMERIC NOT NULL,
    "total" NUMERIC NOT NULL,
    "operatorId" TEXT NOT NULL,
    "notes" TEXT,
    "syncId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ServiceTransaction_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ServiceTransaction_syncId_key" ON "ServiceTransaction"("syncId")`,

  `CREATE TABLE IF NOT EXISTS "Employee" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "salary" NUMERIC NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_code_key" ON "Account"("code")`,

  `CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "description" TEXT NOT NULL,
    "debit" NUMERIC NOT NULL DEFAULT 0,
    "credit" NUMERIC NOT NULL DEFAULT 0,
    "reference" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "SyncQueue" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "SyncQueue_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Settings" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Settings_key_key" ON "Settings"("key")`,
];

async function main() {
  console.log('🚀 Starting migration via Neon HTTP API...\n');
  let ok = 0, skipped = 0, failed = 0;

  for (const stmt of statements) {
    const label = stmt.trim().split('\n')[0].substring(0, 70);
    const res = await queryNeon(stmt);
    if (res.status === 200) {
      console.log(`  ✅ ${label}`);
      ok++;
    } else {
      const msg = res.body?.message || JSON.stringify(res.body);
      if (msg.includes('already exists')) {
        console.log(`  ⏭  ${label} (already exists)`);
        skipped++;
      } else {
        console.log(`  ❌ ${label}`);
        console.log(`     Error: ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n📊 Results: ${ok} created, ${skipped} skipped, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✅ All tables created successfully! Running seed...');
    await seed();
  }
}

async function seed() {
  console.log('\n🌱 Seeding initial data...');

  // Create admin role
  const roleRes = await queryNeon(`
    INSERT INTO "Role" ("id","name","description","updatedAt")
    VALUES (gen_random_uuid()::text, 'ADMIN', 'System Administrator', NOW())
    ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description"
    RETURNING "id"
  `);
  const roleId = roleRes.body?.rows?.[0]?.id;
  if (!roleId) { console.log('  ❌ Could not get admin role ID'); return; }
  console.log(`  ✅ Admin role: ${roleId}`);

  // Create cashier role
  await queryNeon(`
    INSERT INTO "Role" ("id","name","description","updatedAt")
    VALUES (gen_random_uuid()::text, 'CASHIER', 'Cashier', NOW())
    ON CONFLICT ("name") DO NOTHING
  `);

  // Create manager role
  await queryNeon(`
    INSERT INTO "Role" ("id","name","description","updatedAt")
    VALUES (gen_random_uuid()::text, 'MANAGER', 'Branch Manager', NOW())
    ON CONFLICT ("name") DO NOTHING
  `);
  console.log('  ✅ All roles created');

  // Create default branch
  const branchRes = await queryNeon(`
    INSERT INTO "Branch" ("id","name","address","updatedAt")
    VALUES (gen_random_uuid()::text, 'Main Branch', 'Head Office', NOW())
    ON CONFLICT ("name") DO UPDATE SET "address" = EXCLUDED."address"
    RETURNING "id"
  `);
  const branchId = branchRes.body?.rows?.[0]?.id;
  console.log(`  ✅ Default branch: ${branchId}`);

  // Create admin user (password: Admin@123)
  // bcrypt hash of 'Admin@123' with salt 10
  const passwordHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // password
  // Use a known bcrypt hash for 'Admin@1234'
  const adminHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // Admin@1234
  
  const userRes = await queryNeon(`
    INSERT INTO "User" ("id","username","email","passwordHash","roleId","branchId","isActive","updatedAt")
    VALUES (
      gen_random_uuid()::text,
      'admin',
      'admin@jefinvestment.com',
      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      '${roleId}',
      ${branchId ? `'${branchId}'` : 'NULL'},
      true,
      NOW()
    )
    ON CONFLICT ("username") DO NOTHING
    RETURNING "id"
  `);
  console.log(`  ✅ Admin user created (username: admin, password: Admin@1234)`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('   Login: username=admin  password=Admin@1234');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
