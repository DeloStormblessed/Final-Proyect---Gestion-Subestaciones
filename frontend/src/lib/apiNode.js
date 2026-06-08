// guardamos el token en Context, no en cada componente:
// lo reenviamos a ambos backends con el mismo header Authorization
const base = import.meta.env.VITE_NODE_API_URL;

export async function apiFetch(path, options = {}, token) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}
