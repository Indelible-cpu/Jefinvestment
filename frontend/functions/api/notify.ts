// Cloudflare Pages Function: /api/notify
// Handles sending FCM push notifications server-side using Google Service Account

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf.buffer;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
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

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const keyBuffer = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const jwt = `${signatureInput}.${arrayBufferToBase64Url(signatureBuffer)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to fetch Google OAuth token: ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const rawBody = await context.request.json();
    const {
      type,
      saleId,
      invoiceNumber,
      orderNumber,
      cashierName,
      cashierUid,
      amount,
      paymentMethod,
      currency = 'MWK',
      itemCount,
    } = rawBody as any;

    const saJson = context.env?.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not found in environment');
      return new Response(
        JSON.stringify({
          success: false,
          warning:
            'FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not configured in Cloudflare Pages.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(saJson);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || 'jefinvestment-e1fc1';

    // Query Firestore for users with role ADMIN or MANAGER
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;
    const usersRes = await fetch(firestoreUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!usersRes.ok) {
      const err = await usersRes.text();
      console.warn('Failed to query users from Firestore REST API:', err);
    }

    const usersData = usersRes.ok ? ((await usersRes.json()) as any) : { documents: [] };
    const documents = usersData.documents || [];

    const tokensToSend: string[] = [];

    for (const doc of documents) {
      const fields = doc.fields || {};
      const userId = doc.name.split('/').pop();
      const role = fields.role?.stringValue || '';
      const isSuspended = fields.isSuspended?.booleanValue || false;
      const isActive = fields.isActive?.booleanValue !== false;

      if (type === 'SERVING_DUE') {
        // Target active CASHIER accounts for serving notifications
        if (role !== 'CASHIER' || isSuspended || !isActive) {
          continue;
        }
      } else {
        // Only target active ADMIN and MANAGER accounts for sales and online orders
        if ((role !== 'ADMIN' && role !== 'MANAGER') || isSuspended || !isActive) {
          continue;
        }

        // DO NOT notify the cashier who made the sale about their own sale
        if (type === 'SALE' && cashierUid && userId === cashierUid) {
          continue;
        }

        // Check user's notification preferences if configured
        const prefsMap = fields.notificationPrefs?.mapValue?.fields;
        if (prefsMap) {
          if (type === 'SALE' && prefsMap.notifyCashierSales?.booleanValue === false) {
            continue;
          }
          if (type === 'ONLINE_ORDER' && prefsMap.notifyOnlineOrders?.booleanValue === false) {
            continue;
          }
        }
      }

      // Collect user's registered FCM tokens
      const fcmTokensArray = fields.fcmTokens?.arrayValue?.values || [];
      for (const t of fcmTokensArray) {
        if (t.stringValue) {
          tokensToSend.push(t.stringValue);
        }
      }
    }

    if (tokensToSend.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No eligible target devices found to notify.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Format notification text based on source
    let title = '🔔 New Sale — JEF Investment';
    let body = '';
    let targetUrl = '/sales';

    const formattedAmount = Number(amount || 0).toLocaleString();

    if (type === 'SERVING_DUE') {
      title = '🔔 Daily Serving Due — JEF Investment';
      body = `Today's Serving Amount: ${currency} ${formattedAmount}\nClosing in 10 minutes. Please serve/remit this exact calculated amount.`;
      targetUrl = '/pos';
    } else if (type === 'ONLINE_ORDER') {
      title = '🔔 New Online Order';
      body = `Order #: ${orderNumber || 'Online'}\nAmount: ${currency} ${formattedAmount}`;
      targetUrl = '/online-orders';
    } else {
      title = '🔔 New Sale — JEF Investment';
      body = `Cashier: ${cashierName || 'Staff'}\nSale #: ${invoiceNumber || 'INV'}\nAmount: ${currency} ${formattedAmount}\nPayment: ${paymentMethod || 'Cash'}`;
      targetUrl = '/sales';
    }

    // Send notifications via FCM v1 API in parallel
    const fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const sendPromises = tokensToSend.map(async (token) => {
      const messagePayload = {
        message: {
          token,
          notification: {
            title,
            body,
          },
          data: {
            url: targetUrl,
            type: type || 'SALE',
            saleId: saleId || '',
            invoiceNumber: invoiceNumber || orderNumber || '',
            amount: String(amount || ''),
            cashier: cashierName || '',
          },
          webpush: {
            fcm_options: {
              link: targetUrl,
            },
            notification: {
              title,
              body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              vibrate: [200, 100, 200],
            },
          },
        },
      };

      const res = await fetch(fcmSendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      return { ok: res.ok, status: res.status };
    });

    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.ok
    ).length;

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successCount,
        totalTargets: tokensToSend.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error handling push notification request:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Internal server error in push dispatcher',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
