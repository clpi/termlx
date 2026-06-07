/** Ping a local/remote model server's /models endpoint, return HTTP status. */
export async function lmPing(_root, { baseUrl }) {
  const url = baseUrl.replace(/\/+$/, "") + "/models";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

/** Non-streaming HTTP proxy. body is a byte array (number[]). */
export async function aiHttpRequest(_root, { url, method, headers, body }) {
  const res = await fetch(url, {
    method: method || "GET",
    headers: headers || {},
    body: body ? Buffer.from(body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const h = {};
  res.headers.forEach((v, k) => {
    h[k] = v;
  });
  return { status: res.status, headers: h, body: Array.from(buf) };
}

/** Streaming HTTP proxy: pipes upstream status/headers/body to the Express
 *  response. The browser shim reconstructs a Response from this. */
export async function aiHttpStream(req, res) {
  const { url, method, headers, body } = req.body || {};
  try {
    const upstream = await fetch(url, {
      method: method || "GET",
      headers: headers || {},
      body: body ? Buffer.from(body) : undefined,
    });
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    res.setHeader("cache-control", "no-cache");
    if (!upstream.body) {
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(502);
    res.end(String(e?.message ?? e));
  }
}
