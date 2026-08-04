import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { sign, verify } from './utils/jwt';
import bcrypt from 'bcryptjs';

export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
};

// Parse postgres connection string manually (avoids relying on Node.js url.parse
// which is not available or broken in Cloudflare Workers bundles)
function parseDbUrl(rawUrl: string) {
  const url = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  // Matches: postgres(ql)://user:password@host/database?params
  const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
  if (!m) throw new Error(`DATABASE_URL could not be parsed. Got prefix: ${url.substring(0, 20)}`);
  return {
    user: m[1],
    password: decodeURIComponent(m[2]),
    host: m[3],
    database: m[4],
    ssl: true,
  };
}

// Helper: get prisma for a given env
function getPrisma(env: Env) {
  neonConfig.webSocketConstructor = WebSocket;

  if (!env.DATABASE_URL) throw new Error('DATABASE_URL secret is not set in Cloudflare Worker');

  const connParams = parseDbUrl(env.DATABASE_URL);
  const pool = new Pool(connParams);
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter } as any);
}

const app = new Hono<{ Bindings: Env }>();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  return cors({
    origin: c.env.CORS_ORIGIN || '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
    credentials: true,
  })(c, next);
});

// ─── Error Handler ─────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(err);
  return c.json({ status: 'error', message: err.message || 'Internal Server Error' }, 500);
});

// ─── Auth Helper ───────────────────────────────────────────────────────────────
async function getAuthUser(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return await verify(token, c.env.JWT_SECRET);
  } catch {
    return null;
  }
}

async function requireAuth(c: any, next: any) {
  const user = await getAuthUser(c);
  if (!user) return c.json({ status: 'error', message: 'Unauthorized' }, 401);
  c.set('user', user);
  await next();
}

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health/db', async (c) => {
  let dbUrl = c.env.DATABASE_URL || '';
  dbUrl = dbUrl.trim();
  if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) dbUrl = dbUrl.slice(1, -1);
  if (dbUrl.startsWith("'") && dbUrl.endsWith("'")) dbUrl = dbUrl.slice(1, -1);
  
  const urlInfo = {
    length: dbUrl.length,
    rawPrefix: (c.env.DATABASE_URL || '').substring(0, 15),
    cleanedPrefix: dbUrl.substring(0, 15),
  };
  try {
    const prisma = getPrisma(c.env);
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: 'ok', db: 'connected', urlInfo });
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message, name: err.name, urlInfo }, 500);
  }
});

// ─── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/v1/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  let prisma: any;
  try {
    prisma = getPrisma(c.env);
  } catch (err: any) {
    console.error('getPrisma failed:', err.message, err.name);
    return c.json({ status: 'error', message: 'DB init failed: ' + err.message }, 500);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
      include: { role: true, branch: true },
    });

    if (!user || !user.isActive) {
      return c.json({ status: 'error', message: 'Invalid credentials or inactive account' }, 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return c.json({ status: 'error', message: 'Invalid credentials' }, 401);
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const payload = { id: user.id, username: user.username, name: user.username, role: user.role.name, branchId: user.branchId };
    const token = await sign(payload, c.env.JWT_SECRET, c.env.JWT_EXPIRES_IN || '1d');

    return c.json({
      status: 'success',
      data: {
        token,
        user: { id: user.id, username: user.username, name: user.username, role: user.role.name, branchId: user.branchId, branchName: user.branch?.name },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
});

// ─── Inventory / Products ──────────────────────────────────────────────────────
app.get('/api/v1/inventory', requireAuth, async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const products = await prisma.product.findMany({
      include: { category: true, variants: true, branches: { include: { branch: true } } },
      orderBy: { name: 'asc' },
    });
    return c.json({ status: 'success', data: products });
  } finally {
    await prisma.$disconnect();
  }
});

app.post('/api/v1/inventory', requireAuth, async (c) => {
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    const { name, categoryId, sku, barcode, description, unit, costPrice, sellingPrice, reorderLevel, isService, initialStock, branchId } = body;
    const product = await prisma.product.create({
      data: { name, categoryId, sku, barcode, description, unit, costPrice, sellingPrice, reorderLevel, isService },
    });
    // Set initial stock for the branch
    if (branchId && !isService && initialStock > 0) {
      await prisma.productBranch.create({ data: { productId: product.id, branchId, quantity: initialStock } });
    }
    return c.json({ status: 'success', data: product }, 201);
  } finally {
    await prisma.$disconnect();
  }
});

app.put('/api/v1/inventory/:id', requireAuth, async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { name: body.name, categoryId: body.categoryId, sku: body.sku, barcode: body.barcode, description: body.description, unit: body.unit, costPrice: body.costPrice, sellingPrice: body.sellingPrice, reorderLevel: body.reorderLevel, isService: body.isService },
    });
    return c.json({ status: 'success', data: product });
  } finally {
    await prisma.$disconnect();
  }
});

app.delete('/api/v1/inventory/:id', requireAuth, async (c) => {
  const { id } = c.req.param();
  const prisma = getPrisma(c.env);
  try {
    await prisma.product.delete({ where: { id } });
    return c.json({ status: 'success', message: 'Product deleted' });
  } finally {
    await prisma.$disconnect();
  }
});

// Product Categories
app.get('/api/v1/inventory/categories', requireAuth, async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const cats = await prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
    return c.json({ status: 'success', data: cats });
  } finally {
    await prisma.$disconnect();
  }
});

app.post('/api/v1/inventory/categories', requireAuth, async (c) => {
  const { name, description } = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    const cat = await prisma.productCategory.create({ data: { name, description } });
    return c.json({ status: 'success', data: cat }, 201);
  } finally {
    await prisma.$disconnect();
  }
});

// ─── Sales ─────────────────────────────────────────────────────────────────────
app.get('/api/v1/sales', requireAuth, async (c) => {
  const user = c.get('user') as any;
  const prisma = getPrisma(c.env);
  try {
    const where = user.role === 'CASHIER' ? { userId: user.id } : {};
    const sales = await prisma.sale.findMany({
      where,
      include: { items: { include: { product: { select: { name: true } } } }, payments: true, user: { select: { id: true, username: true } }, branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return c.json({ status: 'success', data: sales });
  } finally {
    await prisma.$disconnect();
  }
});

app.post('/api/v1/sales', requireAuth, async (c) => {
  const user = c.get('user') as any;
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    const { invoiceNumber, customerName, customerPhone, subtotal, discount, taxAmount, taxName, taxType, total, items, paymentMethod, amountPaid, isCredit, dueDate, syncId } = body;

    const branchId = user.branchId;
    if (!branchId) return c.json({ status: 'error', message: 'User must be assigned to a branch' }, 400);

    const sale = await prisma.sale.create({
      data: {
        invoiceNumber,
        branchId,
        userId: user.id,
        customerName,
        customerPhone,
        subtotal,
        discount: discount || 0,
        total,
        status: isCredit ? 'CREDIT' : 'COMPLETED',
        isCredit: !!isCredit,
        creditAmount: isCredit ? total : 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        syncId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            subtotal: item.quantity * item.unitPrice - (item.discount || 0),
          })),
        },
        payments: {
          create: [{ method: paymentMethod, amount: amountPaid || total }],
        },
      },
      include: { items: true, payments: true },
    });

    // Decrement stock for physical products
    for (const item of items) {
      if (!item.isService && item.productId) {
        const pb = await prisma.productBranch.findUnique({ where: { productId_branchId: { productId: item.productId, branchId } } });
        if (pb) {
          await prisma.productBranch.update({ where: { id: pb.id }, data: { quantity: Math.max(0, pb.quantity - item.quantity) } });
        }
      }
    }

    return c.json({ status: 'success', data: sale }, 201);
  } finally {
    await prisma.$disconnect();
  }
});

app.put('/api/v1/sales/:id/void', requireAuth, async (c) => {
  const { id } = c.req.param();
  const prisma = getPrisma(c.env);
  try {
    const sale = await prisma.sale.update({ where: { id }, data: { status: 'VOIDED' } });
    return c.json({ status: 'success', data: sale });
  } finally {
    await prisma.$disconnect();
  }
});

app.put('/api/v1/sales/:id/refund', requireAuth, async (c) => {
  const { id } = c.req.param();
  const prisma = getPrisma(c.env);
  try {
    const sale = await prisma.sale.update({ where: { id }, data: { status: 'REFUNDED' } });
    return c.json({ status: 'success', data: sale });
  } finally {
    await prisma.$disconnect();
  }
});

// ─── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/v1/settings', requireAuth, async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const rows = await prisma.settings.findMany();
    const settings: Record<string, string> = {};
    rows.forEach((r) => { settings[r.key] = r.value; });
    return c.json({ status: 'success', data: settings });
  } finally {
    await prisma.$disconnect();
  }
});

app.post('/api/v1/settings', requireAuth, async (c) => {
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    for (const [key, value] of Object.entries(body)) {
      await prisma.settings.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
    return c.json({ status: 'success', message: 'Settings updated' });
  } finally {
    await prisma.$disconnect();
  }
});

// ─── Users (Admin only) ────────────────────────────────────────────────────────
app.get('/api/v1/users', requireAuth, async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const users = await prisma.user.findMany({ include: { role: true, branch: true }, orderBy: { createdAt: 'asc' } });
    return c.json({ status: 'success', data: users.map(u => ({ id: u.id, username: u.username, name: u.username, role: u.role.name, branchId: u.branchId, isActive: u.isActive })) });
  } finally {
    await prisma.$disconnect();
  }
});

app.post('/api/v1/users', requireAuth, async (c) => {
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    const hash = await bcrypt.hash(body.password, 10);
    // Find role by name
    const role = await prisma.role.findFirst({ where: { name: body.role } });
    if (!role) return c.json({ status: 'error', message: `Role "${body.role}" not found` }, 400);
    const user = await prisma.user.create({ data: { username: body.username, passwordHash: hash, roleId: role.id, branchId: body.branchId || null, isActive: true } });
    return c.json({ status: 'success', data: { id: user.id, username: user.username, role: body.role } }, 201);
  } finally {
    await prisma.$disconnect();
  }
});

app.put('/api/v1/users/:id/password', requireAuth, async (c) => {
  const { id } = c.req.param();
  const { password } = await c.req.json();
  const prisma = getPrisma(c.env);
  try {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    return c.json({ status: 'success', message: 'Password updated' });
  } finally {
    await prisma.$disconnect();
  }
});

app.delete('/api/v1/users/:id', requireAuth, async (c) => {
  const { id } = c.req.param();
  const prisma = getPrisma(c.env);
  try {
    await prisma.user.delete({ where: { id } });
    return c.json({ status: 'success', message: 'User deleted' });
  } finally {
    await prisma.$disconnect();
  }
});

// ─── Branches ──────────────────────────────────────────────────────────────────
app.get('/api/v1/branches', requireAuth, async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
    return c.json({ status: 'success', data: branches });
  } finally {
    await prisma.$disconnect();
  }
});

// ─── Reports ───────────────────────────────────────────────────────────────────
app.get('/api/v1/reports/summary', requireAuth, async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalSales, todaySales, topProducts] = await Promise.all([
      prisma.sale.aggregate({ _sum: { total: true }, where: { status: 'COMPLETED' } }),
      prisma.sale.aggregate({ _sum: { total: true }, _count: true, where: { status: 'COMPLETED', createdAt: { gte: today } } }),
      prisma.saleItem.groupBy({ by: ['productId'], _sum: { quantity: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 5 }),
    ]);

    return c.json({
      status: 'success',
      data: {
        totalRevenue: totalSales._sum.total || 0,
        todayRevenue: todaySales._sum.total || 0,
        todayTransactions: todaySales._count,
        topProducts,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
});

export default app;
// Trigger deployment
// trigger redeploy with secrets
// fix secret injection
// retry with JWT_SECRET
