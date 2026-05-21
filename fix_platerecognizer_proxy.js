const fs = require('fs');
const { execSync } = require('child_process');

// 1. Create netlify/functions directory
fs.mkdirSync('netlify/functions', { recursive: true });

// 2. Create the proxy function
const proxyFunction = `exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    // Parse the base64 image from the request
    const body = JSON.parse(event.body)
    const base64Image = body.image

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Image, 'base64')

    // Create form data manually for Node.js
    const boundary = '----SENTRiBoundary' + Date.now()
    const CRLF = '\\r\\n'

    let formBody = ''
    formBody += '--' + boundary + CRLF
    formBody += 'Content-Disposition: form-data; name="regions"' + CRLF + CRLF
    formBody += 'ng' + CRLF

    const formPrefix = '--' + boundary + CRLF +
      'Content-Disposition: form-data; name="upload"; filename="plate.jpg"' + CRLF +
      'Content-Type: image/jpeg' + CRLF + CRLF

    const formSuffix = CRLF + '--' + boundary + '--' + CRLF

    const prefixBuffer = Buffer.from(formPrefix)
    const suffixBuffer = Buffer.from(formSuffix + formBody.split(boundary)[0])

    // Actually let's use a simpler approach with the fetch API
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: global.fetch }))

    // Use FormData with node-fetch
    const FormData = (await import('form-data')).default
    const form = new FormData()
    form.append('upload', imageBuffer, { filename: 'plate.jpg', contentType: 'image/jpeg' })
    form.append('regions', 'ng')

    const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
      method: 'POST',
      headers: {
        'Authorization': 'Token cd023a0e31de97d28995b3849851088c23403542',
        ...form.getHeaders()
      },
      body: form
    })

    const data = await response.json()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    }
  } catch (error) {
    console.error('Proxy error:', error)
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message, results: [] })
    }
  }
}
`;

fs.writeFileSync('netlify/functions/plate-recognizer.js', proxyFunction, 'utf8');
console.log('Created netlify/functions/plate-recognizer.js');

// 3. Update netlify.toml
const netlifyToml = `[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
fs.writeFileSync('netlify.toml', netlifyToml, 'utf8');
console.log('Updated netlify.toml');

// 4. Update AdmitPage to call local proxy instead of PlateRecognizer directly
let admit = fs.readFileSync('src/pages/gate/AdmitPage.jsx', 'utf8');

const oldFetch = `      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.95))
      const formData = new FormData()
      formData.append('upload', blob, 'plate.jpg')
      formData.append('regions', 'ng')

      const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
        method: 'POST',
        headers: { 'Authorization': 'Token ' + PR_TOKEN },
        body: formData
      })

      if (!response.ok) {
        throw new Error('API error: ' + response.status)
      }

      const data = await response.json()`;

const newFetch = `      // Convert canvas to base64 and send to our serverless proxy
      const base64 = c.toDataURL('image/jpeg', 0.95).split(',')[1]

      const response = await fetch('/.netlify/functions/plate-recognizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      })

      if (!response.ok) {
        throw new Error('API error: ' + response.status)
      }

      const data = await response.json()`;

if (admit.includes(oldFetch)) {
  admit = admit.replace(oldFetch, newFetch);
  // Remove PR_TOKEN constant since we no longer need it in frontend
  admit = admit.replace("const PR_TOKEN = 'cd023a0e31de97d28995b3849851088c23403542'\n\n", '');
  fs.writeFileSync('src/pages/gate/AdmitPage.jsx', admit, 'utf8');
  console.log('AdmitPage updated to use proxy');
} else {
  console.log('Fetch pattern not found');
}

// 5. Create package.json for functions with form-data dependency
const fnPackage = {
  name: "sentri-functions",
  version: "1.0.0",
  dependencies: {
    "form-data": "^4.0.0",
    "node-fetch": "^2.7.0"
  }
};
fs.writeFileSync('netlify/functions/package.json', JSON.stringify(fnPackage, null, 2), 'utf8');
console.log('Created functions package.json');

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Add Netlify proxy function for PlateRecognizer - fixes CORS"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done. Netlify deploying...');
