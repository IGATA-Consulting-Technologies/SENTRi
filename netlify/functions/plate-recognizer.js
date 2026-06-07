const https = require('https')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { image } = JSON.parse(event.body)
    if (!image) return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) }

    const imageBuffer = Buffer.from(image, 'base64')
    const boundary = 'SENTRiBoundary' + Date.now()

    // Build multipart form manually — no npm needed
    const regionPart = [
      '--' + boundary,
      'Content-Disposition: form-data; name="regions"',
      '',
      'ng'
    ].join('\r\n')

    const filePart = [
      '\r\n--' + boundary,
      'Content-Disposition: form-data; name="upload"; filename="plate.jpg"',
      'Content-Type: image/jpeg',
      ''
    ].join('\r\n')

    const closing = '\r\n--' + boundary + '--\r\n'

    const body = Buffer.concat([
      Buffer.from(regionPart + '\r\n'),
      Buffer.from(filePart + '\r\n'),
      imageBuffer,
      Buffer.from(closing)
    ])

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.platerecognizer.com',
        path: '/v1/plate-reader/',
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + process.env.PLATE_RECOGNIZER_TOKEN,
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': body.length
        }
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(new Error('Invalid JSON from PlateRecognizer: ' + data)) }
        })
      })

      req.on('error', reject)
      req.write(body)
      req.end()
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }

  } catch (error) {
    console.error('Proxy error:', error.message)
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message, results: [] })
    }
  }
}
