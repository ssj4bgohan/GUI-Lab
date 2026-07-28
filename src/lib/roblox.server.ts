const ROBLOX_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export async function resolveRobloxUser(
  username: string,
): Promise<{ id: number; name: string } | null> {
  // Method 1: POST usernames/users
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: ROBLOX_HEADERS,
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{ id: number; name: string }>;
      };
      const user = json.data?.[0];
      if (user) return { id: user.id, name: user.name };
    }
  } catch (error) {
    console.error("[Roblox API] Error in POST usernames/users:", error);
  }

  // Method 2: GET users/search fallback
  try {
    const searchRes = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(
        username,
      )}&limit=10`,
      { headers: ROBLOX_HEADERS },
    );
    if (searchRes.ok) {
      const searchJson = (await searchRes.json()) as {
        data?: Array<{ id: number; name: string }>;
      };
      const exactMatch = searchJson.data?.find(
        (u) => u.name.toLowerCase() === username.toLowerCase(),
      );
      if (exactMatch) return { id: exactMatch.id, name: exactMatch.name };
      if (searchJson.data?.[0]) {
        return { id: searchJson.data[0].id, name: searchJson.data[0].name };
      }
    }
  } catch (error) {
    console.error("[Roblox API] Error in GET search fallback:", error);
  }

  return null;
}

export async function getRobloxDescription(userId: number): Promise<string> {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
      headers: ROBLOX_HEADERS,
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { description?: string };
    return json.description ?? "";
  } catch (error) {
    console.error("[Roblox API] Error fetching description:", error);
    return "";
  }
}

export async function ownsGamepass(
  userId: number,
  gamepassId: number,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamepassId}/is-owned`,
      { headers: ROBLOX_HEADERS },
    );
    if (!res.ok) return false;
    const text = (await res.text()).trim().toLowerCase();
    return text === "true";
  } catch (error) {
    console.error("[Roblox API] Error checking gamepass ownership:", error);
    return false;
  }
}

export function makeVerificationCode(): string {
  return `GUILAB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function getRobloxAvatarUrl(userId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshots?userIds=${userId}&size=150x150&format=Png&isCircular=true`,
      { headers: ROBLOX_HEADERS },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{ imageUrl?: string; state?: string }>;
      };
      const item = json.data?.[0];
      if (item?.imageUrl) return item.imageUrl;
    }
  } catch {
    // fallback below
  }
  return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
}
