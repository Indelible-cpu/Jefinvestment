/**
 * Prisma Seed Script
 * Run with: npx ts-node prisma/seed.ts  (or: npx tsx prisma/seed.ts)
 *
 * Creates:
 *  - Roles: ADMIN, CASHIER, MANAGER
 *  - Default Branch: Main Branch
 *  - Admin user:  username=jefinvestmentmw@gmail.com  password=admin1234#
 *  - Default Product Categories
 *  - Default Expense Categories
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── Roles ─────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Full system access' },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: { name: 'CASHIER', description: 'Point of sale access only' },
  });

  await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER', description: 'Management & reports access' },
  });

  console.log('✅ Roles created');

  // ─── Default Branch ────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { name: 'Main Branch' },
    update: {},
    create: { name: 'Main Branch', address: 'Main Location', phone: '' },
  });

  console.log('✅ Default branch created:', branch.name);

  // ─── Admin User ────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('admin1234#', 12);

  const adminUser = await prisma.user.upsert({
    where: { username: 'jefinvestmentmw@gmail.com' },
    update: {},
    create: {
      username: 'jefinvestmentmw@gmail.com',
      email: 'jefinvestmentmw@gmail.com',
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      branchId: branch.id,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', adminUser.username, '/ password: admin1234#');

  // ─── Default Cashier ───────────────────────────────────────────────────────
  const cashierPasswordHash = await bcrypt.hash('Cashier@1234', 12);

  await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {},
    create: {
      username: 'cashier',
      email: 'cashier@jefinvestment.com',
      passwordHash: cashierPasswordHash,
      roleId: cashierRole.id,
      branchId: branch.id,
      isActive: true,
    },
  });

  console.log('✅ Cashier user created: cashier / Cashier@1234');

  // ─── Product Categories ────────────────────────────────────────────────────
  const productCategories = [
    'Electronics', 'Clothing & Apparel', 'Food & Beverages',
    'Health & Beauty', 'Household', 'Office Supplies',
    'Services', 'Other',
  ];

  for (const name of productCategories) {
    await prisma.productCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Product categories created');

  // ─── Expense Categories ────────────────────────────────────────────────────
  const expenseCategories = [
    'Rent', 'Utilities', 'Salaries', 'Transport',
    'Supplies', 'Marketing', 'Maintenance', 'Other',
  ];

  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Expense categories created');

  // ─── Default Settings ──────────────────────────────────────────────────────
  const defaultSettings: Record<string, string> = {
    companyName: 'Jef Investment',
    address: '',
    phone: '',
    email: '',
    taxNumber: '',
    taxName: 'VAT',
    taxRate: '16.5',
    taxType: 'EXCLUSIVE',
    airtelNumber: '',
    mpambaNumber: '',
    nbsDetails: '',
    nbmDetails: '',
    companyLogo: '',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.settings.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log('✅ Default settings seeded');
  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────');
  console.log('Admin Login:   jefinvestmentmw@gmail.com / admin1234#');
  console.log('Cashier Login: cashier / Cashier@1234');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
