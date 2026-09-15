import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dev server middleware that handles /api/notify using the local service-account.json
export function fcmDevPlugin(): Plugin {
  return {
    name: 'fcm-dev-notify',
    configureServer(server) {
      server.middlewares.use('/api/notify', async (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        let bodyStr = '';
        req.on('data', (chunk: any) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const saPath = path.resolve(__dirname, '../service-account.json');

            if (!fs.existsSync(saPath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  warning: 'service-account.json not found in workspace root for dev testing.',
                })
              );
              return;
            }

            const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

            // Sign JWT for Google OAuth2
            const now = Math.floor(Date.now() / 1000);
            const header = { alg: 'RS256', typ: 'JWT' };
            const claimSet = {
              iss: sa.client_email,
              scope:
                'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
              aud: 'https://oauth2.googleapis.com/token',
              exp: now + 3600,
              iat: now,
            };

            const b64Url = (obj: any) =>
              Buffer.from(JSON.stringify(obj))
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const signInput = `${b64Url(header)}.${b64Url(claimSet)}`;
            const sign = crypto.createSign('RSA-SHA256');
            sign.update(signInput);
            const signature = sign
              .sign(sa.private_key, 'base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            const jwt = `${signInput}.${signature}`;

            // Fetch Google access token
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
            });

            if (!tokenRes.ok) {
              const err = await tokenRes.text();
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err }));
              return;
            }

            const { access_token } = (await tokenRes.json()) as { access_token: string };
            const projectId = sa.project_id || 'jefinvestment-e1fc1';

            // Query Firestore for users with role ADMIN or MANAGER
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;
            const usersRes = await fetch(firestoreUrl, {
              headers: { Authorization: `Bearer ${access_token}` },
            });

            const usersData = usersRes.ok ? ((await usersRes.json()) as any) : { documents: [] };
            const documents = usersData.documents || [];

            const tokensToSend: string[] = [];

            for (const doc of documents) {
              const fields = doc.fields || {};
              const userId = doc.name.split('/').pop();
              const role = fields.role?.stringValue || '';
              const isSuspended = fields.isSuspended?.booleanValue || false;
              const isActive = fields.isActive?.booleanValue !== false;

              if (body.type === 'SERVING_DUE') {
                if (role !== 'CASHIER' || isSuspended || !isActive) {
                  continue;
                }
              } else {
                if ((role !== 'ADMIN' && role !== 'MANAGER') || isSuspended || !isActive) {
                  continue;
                }

                // Do not notify cashier about their own sale
                if (body.type === 'SALE' && body.cashierUid && userId === body.cashierUid) {
                  continue;
                }

                const prefsMap = fields.notificationPrefs?.mapValue?.fields;
                if (prefsMap) {
                  if (body.type === 'SALE' && prefsMap.notifyCashierSales?.booleanValue === false) {
                    continue;
                  }
                  if (body.type === 'ONLINE_ORDER' && prefsMap.notifyOnlineOrders?.booleanValue === false) {
                    continue;
                  }
                }
              }

              const fcmTokens = fields.fcmTokens?.arrayValue?.values || [];
              for (const t of fcmTokens) {
                if (t.stringValue) tokensToSend.push(t.stringValue);
              }
            }

            if (tokensToSend.length === 0) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'No devices found to notify.' }));
              return;
            }

            const formattedAmount = Number(body.amount || 0).toLocaleString();
            let title = '🔔 New Sale — JEF Investment';
            let bodyText = '';
            let targetUrl = '/sales';

            if (body.type === 'SERVING_DUE') {
              title = '🔔 Daily Serving Due — JEF Investment';
              bodyText = `Today's Serving Amount: ${body.currency || 'MWK'} ${formattedAmount}\nClosing in 10 minutes. Please serve/remit this exact calculated amount.`;
              targetUrl = '/pos';
            } else if (body.type === 'ONLINE_ORDER') {
              title = '🔔 New Online Order';
              bodyText = `Order #: ${body.orderNumber || 'Online'}\nAmount: ${body.currency || 'MWK'} ${formattedAmount}`;
              targetUrl = '/online-orders';
            } else {
              title = '🔔 New Sale — JEF Investment';
              bodyText = `Cashier: ${body.cashierName || 'Staff'}\nSale #: ${body.invoiceNumber || 'INV'}\nAmount: ${body.currency || 'MWK'} ${formattedAmount}\nPayment: ${body.paymentMethod || 'Cash'}`;
              targetUrl = '/sales';
            }

            const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
            const sendPromises = tokensToSend.map((token) => {
              const msg = {
                message: {
                  token,
                  notification: { title, body: bodyText },
                  data: {
                    url: targetUrl,
                    type: body.type || 'SALE',
                    saleId: body.saleId || '',
                    invoiceNumber: body.invoiceNumber || body.orderNumber || '',
                    amount: String(body.amount || ''),
                    cashier: body.cashierName || '',
                  },
                  webpush: {
                    fcm_options: { link: targetUrl },
                    notification: {
                      title,
                      body: bodyText,
                      icon: '/pwa-192x192.png',
                      badge: '/pwa-192x192.png',
                    },
                  },
                },
              };

              return fetch(fcmSendUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(msg),
              });
            });

            await Promise.allSettled(sendPromises);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, sentCount: tokensToSend.length }));
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
      });
    },
  };
}
