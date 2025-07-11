// This file demonstrates how to proxy the Fly Machines API
// Due to CORS restrictions, the Fly Machines API cannot be called directly from browsers
// You'll need to deploy this as a backend service or use a proxy server

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query
  const apiPath = Array.isArray(path) ? path.join('/') : path
  const apiUrl = `https://api.machines.dev/v1/${apiPath}`

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Forward the authorization header
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization
  }

  try {
    const response = await fetch(apiUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to proxy request' })
  }
}