export function corsHeaders(methods, allowedHeaders = 'Content-Type') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowedHeaders
  };
}

export function handleCorsPreflight(request, methods, allowedHeaders = 'Content-Type') {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(methods, allowedHeaders)
  });
}

export function jsonResponse(
  body,
  {
    status = 200,
    methods = 'GET, OPTIONS',
    allowedHeaders = 'Content-Type',
    headers = {}
  } = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(methods, allowedHeaders),
      ...headers
    }
  });
}

export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'Invalid JSON body' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}
