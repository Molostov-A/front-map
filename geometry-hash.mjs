// Снимок геометрии для проверки конфликта без повторной отправки большого контура.
export async function geometryHash(geometry) {
  const bytes = new TextEncoder().encode(JSON.stringify(geometry));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}
