async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Something went wrong');
    error.status = response.status;
    error.retryAfter = response.headers.get('Retry-After');
    throw error;
  }
  return body;
}

function request(path, options = {}) {
  return fetch(`${API_BASE_URL}${path.replace(/^\/api/, '')}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {}),
    },
  }).then(parseResponse);
}

function getToken() {
  return localStorage.getItem('matchwise_token');
}

export function uploadResume(file, _selection, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/resumes`);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = async () => {
      try {
        resolve(await parseResponse(new Response(xhr.responseText, {
          status: xhr.status,
          headers: { 'content-type': xhr.getResponseHeader('content-type') || '' },
        })));
      } catch (error) {
        error.retryAfter = xhr.getResponseHeader('Retry-After');
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading the resume'));
    const form = new FormData();
    form.append('resume', file);
    xhr.send(form);
  });
}

export const api = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getJobs: () => request('/api/jobs'),
  createJob: (payload) => request('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  resumeMatches: (resumeId) => request(
    `/api/resumes/${resumeId}/matches?explain=true&explainTop=3`
  ),
  jobMatches: (jobId) => request(
    `/api/jobs/${jobId}/matches?explain=true&explainTop=3`
  ),
  bulkMatch: (payload) => request('/api/admin/bulk-match', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  jobStatus: (jobId) => request(`/api/admin/jobs/${encodeURIComponent(jobId)}`),
  getStats: (range = '24h') => request(
    `/api/stats?range=${range}`
  ),
};
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
