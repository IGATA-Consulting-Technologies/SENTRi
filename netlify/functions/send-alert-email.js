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
    const { to, subject, html } = JSON.parse(event.body)

    if (!to || !subject || !html) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const payload = JSON.stringify({
      from: 'SENTRi Alerts <alerts@igataconsulting.tech>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_FF99D5ZP_PRQZmErHp9hjUeSYYK5cEcM6',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
          catch (e) { resolve({ status: res.statusCode, body: data }) }
        })
      })

      req.on('error', reject)
      req.write(payload)
      req.end()
    })

    if (result.status === 200 || result.status === 201) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, id: result.body.id })
      }
    } else {
      console.error('Resend error:', result.body)
      return {
        statusCode: result.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: result.body })
      }
    }

  } catch (error) {
    console.error('Email function error:', error.message)
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    }
  }
}
