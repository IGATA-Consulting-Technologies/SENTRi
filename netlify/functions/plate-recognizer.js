exports.handler = async (event) => {
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
    const CRLF = '\r\n'

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
