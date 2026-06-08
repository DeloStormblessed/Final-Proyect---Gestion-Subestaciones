// mismo token JWT emitido por Node: el ia-service lo valida con el mismo JWT_SECRET
const base = import.meta.env.VITE_IA_API_URL;

export async function apiFetchIA(path, options = {}, token) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? data.error ?? res.statusText);
  return data;
}
