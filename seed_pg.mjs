import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_cZivLq7JXh4S@ep-wandering-flower-axpx499e-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function seed() {
  await client.connect();
  console.log('Connected to Neon DB');

  try {
    // 1. Ensure Roles
    await client.query(`
      INSERT INTO "Role" (id, name, description, "createdAt", "updatedAt") 
      VALUES 
        (gen_random_uuid(), 'ADMIN', 'Full system access', NOW(), NOW()),
        (gen_random_uuid(), 'MANAGER', 'Management & reports access', NOW(), NOW()),
        (gen_random_uuid(), 'CASHIER', 'Point of sale access only', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('Roles created/verified.');

    // 2. Ensure Branch
    await client.query(`
      INSERT INTO "Branch" (id, name, address, phone, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Main Branch', 'Main Location', '', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('Branch created/verified.');

    // Get the branch ID
    const branchRes = await client.query(`SELECT id FROM "Branch" WHERE name = 'Main Branch'`);
    const branchId = branchRes.rows[0].id;

    // Get the ADMIN role ID
    const roleRes = await client.query(`SELECT id FROM "Role" WHERE name = 'ADMIN'`);
    const adminRoleId = roleRes.rows[0].id;

    // 3. Admin User
    const passwordHash = await bcrypt.hash('admin1234#', 12);

    await client.query(`
      INSERT INTO "User" (id, name, username, email, "passwordHash", "roleId", "branchId", "isActive", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(), 
        'System Admin', 
        'jefinvestmentmw@gmail.com', 
        'jefinvestmentmw@gmail.com', 
        $1, 
        $2, 
        $3, 
        true, 
        NOW(), 
        NOW()
      )
      ON CONFLICT (username) DO UPDATE SET "passwordHash" = $1, "roleId" = $2, "branchId" = $3;
    `, [passwordHash, adminRoleId, branchId]);

    console.log('Admin user seeded: jefinvestmentmw@gmail.com');
  } catch (err) {
    console.error('Error seeding:', err);
  } finally {
    await client.end();
  }
}

seed();
