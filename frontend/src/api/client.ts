export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/' && !currentPath.startsWith('/auth/callback')) {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401);
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (typeof data === 'object' && data !== null && data.message) 
      ? data.message 
      : (typeof data === 'string' && data ? data : `Request failed with status ${response.status}`);
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  let bodyContent: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyContent = JSON.stringify(body);
  }

  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: bodyContent,
    credentials: 'include',
  });

  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse<T>(response);
}
