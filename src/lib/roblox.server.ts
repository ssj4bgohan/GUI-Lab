/** Roblox public API helpers (server-only). */

export async function resolveRobloxUser(
  username: string,
): Promise<{ id: number; name: string } | null> {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ id: number; name: string }>;
  };
  const user = json.data?.[0];
  return user ? { id: user.id, name: user.name } : null;
}

export async function getRobloxDescription(userId: number): Promise<string> {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!res.ok) return "";
  const json = (await res.json()) as { description?: string };
  return json.description ?? "";
}

export async function ownsGamepass(
  userId: number,
  gamepassId: number,
): Promise<boolean> {
  const res = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamepassId}/is-owned`,
  );
  if (!res.ok) return false;
  const text = (await res.text()).trim().toLowerCase();
  return text === "true";
}

export function makeVerificationCode(): string {
  return `GUILAB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function getRobloxAvatarUrl(userId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ imageUrl?: string; state?: string }>;
    };
    const item = json.data?.[0];
    return item?.imageUrl ?? null;
  } catch {
    return null;
  }
}
