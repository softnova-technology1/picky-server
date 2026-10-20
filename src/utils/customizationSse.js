// ─── Real-Time Server-Sent Events (SSE) Manager for Storefront Customization ───
// Broadcasts instant real-time customization updates from Admin to all open Client storefronts.

const clients = new Set();

/**
 * Register a client connection to the SSE stream
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function addClient(req, res) {
  // Set SSE streaming headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no', // Disable buffering for reverse proxies like nginx
  });

  // Flush headers if supported
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Initial welcome message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  clients.add(res);

  // Keep-alive heartbeat every 20s to prevent proxy/browser idle disconnect
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (e) {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

/**
 * Broadcast real-time customization changes to all connected storefront clients
 * @param {string} pageId - Target page identifier (e.g. 'global_header', 'home')
 * @param {Array} sections - Updated list of sections with latest settings
 */
function broadcastCustomization(pageId, sections) {
  if (clients.size === 0) return;

  const payload = JSON.stringify({
    type: 'CUSTOMIZATION_UPDATED',
    pageId,
    sections,
    timestamp: Date.now(),
  });

  const message = `data: ${payload}\n\n`;

  for (const client of clients) {
    try {
      client.write(message);
    } catch (err) {
      clients.delete(client);
    }
  }
}

module.exports = {
  addClient,
  broadcastCustomization,
  getClientCount: () => clients.size,
};
