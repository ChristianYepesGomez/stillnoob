const RENDER_ORIGIN = 'https://stillnoob-api.onrender.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = RENDER_ORIGIN + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.set('Host', 'stillnoob-api.onrender.com');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
};
