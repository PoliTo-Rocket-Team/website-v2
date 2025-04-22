export async function getAccessToken(realm: string): Promise<string> {
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const clientSecret = realm === 'prt'
    ? process.env.KEYCLOAK_PRT_CLIENT_SECRET!
    : process.env.KEYCLOAK_WIKI_CLIENT_SECRET!;

  const BASE_URL = process.env.KEYCLOAK_BASE_URL!;
  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);

  const res = await fetch(`${BASE_URL}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  return data.access_token;
}

export async function getUserIdByEmail(email: string, realm: string): Promise<string | null> {
  const token = await getAccessToken(realm);
  const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users?email=${email}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const users = await res.json();
  return users.length ? users[0].id : null;
}

export async function createOrUpdateKeycloakUser(email: string, realm: string): Promise<void> {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);

  if (userId) return; 

  const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      username: email,
      enabled: true,
      emailVerified: true,
    }),
  });

  if (!res.ok) {
    console.warn(`[${realm}] Failed to create user ${email}`);
  }
}

export async function getGroupIdByName(groupName: string, realm: string): Promise<string | null> {
  if (groupName === 'leads' && realm === 'prt') {
    return process.env.KEYCLOAK_LEADS_GROUP_ID || null;
  }

  const token = await getAccessToken(realm);
  const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/groups?max=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const groups = await res.json();

  const group = groups.find((g: any) =>
    g.name.toLowerCase() === groupName.toLowerCase()
  );

  return group?.id || null;
}


export async function addUserToGroup(email: string, group: string, realm: string): Promise<void> {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);
  const groupId = await getGroupIdByName(group, realm);

  if (!userId || !groupId) {
    console.warn(`[${realm}] Could not add ${email} to "${group}" — userId=${userId}, groupId=${groupId}`);
    return;
  }

  await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${userId}/groups/${groupId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      realm,
      id: groupId,
    }),
  });
}

export async function removeUserFromGroup(email: string, group: string, realm: string): Promise<void> {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);
  const groupId = await getGroupIdByName(group, realm);

  if (!userId || !groupId) {
    console.warn(` [${realm}] Could not remove ${email} from "${group}" — userId=${userId}, groupId=${groupId}`);
    return;
  }

  await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${userId}/groups/${groupId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getUserGroups(email: string, realm: string): Promise<string[]> {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);
  if (!userId) return [];

  const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${userId}/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  return data.map((g: any) => g.name);
}
