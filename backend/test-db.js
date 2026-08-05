const https = require('https');

const connStr = 'postgresql://neondb_owner:npg_cZivLq7JXh4S@ep-wandering-flower-axpx499e-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function testNeonWithHeader() {
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
      console.log('STATUS:', res.statusCode);
      console.log('RESPONSE:', body);
    });
  });

  req.on('error', (e) => {
    console.error('ERROR:', e.message);
  });

  req.write(JSON.stringify({ query: 'SELECT 1 as test;' }));
  req.end();
}

testNeonWithHeader();
