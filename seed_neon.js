const https = require('https');

const connStr = 'postgresql://neondb_owner:npg_cZivLq7JXh4S@ep-wandering-flower-axpx499e-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const passwordHash = '$2b$12$r.CQDWxJUgVVkkYOCWkbQOJqw59GfbykZOA8/gp3ilvNXVvYbHC0.'; // admin1234#

function queryNeon(sql) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ep-wandering-flower-axpx499e-pooler.c-4.us-east-2.aws.neon.tech',
      path: '/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'neon-connection-string': connStr
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(body));
        else resolve(JSON.parse(body));
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

async function runSeed() {
  try {
    // 1. Create Roles
    console.log('Creating roles...');
    await queryNeon(`
      INSERT INTO "Role" (id, name, description, "createdAt", "updatedAt") 
      VALUES 
        (gen_random_uuid(), 'ADMIN', 'Full system access', NOW(), NOW()),
        (gen_random_uuid(), 'MANAGER', 'Management & reports access', NOW(), NOW()),
        (gen_random_uuid(), 'CASHIER', 'Point of sale access only', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `);

    // 2. Create Branch
    console.log('Creating branch...');
    await queryNeon(`
      INSERT INTO "Branch" (id, name, address, phone, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Main Branch', 'Main Location', '', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `);

    // 3. Get IDs
    const branchRes = await queryNeon(`SELECT id FROM "Branch" WHERE name = 'Main Branch'`);
    const branchId = branchRes?.rows ? branchRes.rows[0].id : branchRes[0]?.id;
    const roleRes = await queryNeon(`SELECT id FROM "Role" WHERE name = 'ADMIN'`);
    const roleId = roleRes?.rows ? roleRes.rows[0].id : roleRes[0]?.id;

    console.log('Branch ID:', branchId);
    console.log('Admin Role ID:', roleId);

    // 4. Create User
    console.log('Creating admin user...');
    await queryNeon(`
      INSERT INTO "User" (id, username, email, "passwordHash", "roleId", "branchId", "isActive", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(), 
        'jefinvestmentmw@gmail.com', 
        'jefinvestmentmw@gmail.com', 
        '${passwordHash}', 
        '${roleId}', 
        '${branchId}', 
        true, 
        NOW(), 
        NOW()
      )
      ON CONFLICT (username) DO UPDATE SET "passwordHash" = '${passwordHash}', "roleId" = '${roleId}', "branchId" = '${branchId}';
    `);

    console.log('✅ Seed completed successfully!');
  } catch (err) {
    console.error('❌ Error during seed:', err.message);
  }
}

runSeed();
