export async function apiFetch(url, options = {}) {
    const token = sessionStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}`}),
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    //Global 401 Handler: If token expires or session wiped, force logout
    if (response.status === 401) {
        sessionStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
    }

    return response;
}