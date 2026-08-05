import path from 'node:path';
import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter() {
      const { neon } = await import('@neondatabase/serverless');
      const { PrismaNeonHttp } = await import('@prisma/adapter-neon');
      const connectionString = process.env.DATABASE_URL!;
      const sql = neon(connectionString);
      return new PrismaNeonHttp(sql as any);
    },
  },
});
