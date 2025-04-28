export async function getAccessToken(realm: string): Promise<string> {
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const clientSecret = realm === 'prt'
    ? process.env.KEYCLOAK_PRT_CLIENT_SECRET!
    : process.env.KEYCLOAK_WIKI_CLIENT_SECRET!;

  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);

  const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/realms/${realm}/protocol/openid-connect/token`, {
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

export async function createOrUpdateKeycloakUser(
  email: string,
  realm: string,
  firstName?: string,
  lastName?: string,
  access?: Record<string, string[]> | null
) {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);

  if (userId) {
    // UPDATE
    await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        username: email,
        enabled: true,
        emailVerified: true,
        firstName: firstName || '',
        lastName: lastName || '',
      }),
    });
  } else {
    
    await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users`, {
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
        firstName: firstName || '',
        lastName: lastName || '',
      }),
    });
  }

  if (!userId || access === undefined) return;

  const requiredGroups = new Set<string>();
  for (const key in access) {
    for (const groupName of access[key]) {
      requiredGroups.add(groupName);
    }
  }

  const currentGroups = await getUserGroups(email, realm);
  const toAdd = [...requiredGroups].filter(g => !currentGroups.includes(g));
  const toRemove = currentGroups.filter(g => !requiredGroups.has(g));

  for (const groupName of toAdd) {
    await addUserToGroup(email, groupName, realm);
  }

  for (const groupName of toRemove) {
    await removeUserFromGroup(email, groupName, realm);
  }
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

export async function getAllRealmGroups(realm: string): Promise<any[]> {
  const token = await getAccessToken(realm);
  const res = await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/groups?max=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return await res.json();
}

export async function getGroupIdByName(name: string, realm: string): Promise<string | null> {
  const groups = await getAllRealmGroups(realm);
  const group = groups.find((g: any) => g.name.toLowerCase() === name.toLowerCase());
  return group?.id || null;
}

export async function addUserToGroup(email: string, groupName: string, realm: string) {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);
  let groupId = await getGroupIdByName(groupName, realm);

  if (!groupId) {
    
    const createRes = await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/groups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: groupName }),
    });
    if (createRes.ok) {
      const groups = await getAllRealmGroups(realm);
      groupId = groups.find((g: any) => g.name === groupName)?.id || null;
    }
  }

  if (!userId || !groupId) return;

  await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${userId}/groups/${groupId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: groupId }),
  });
}

export async function removeUserFromGroup(email: string, groupName: string, realm: string) {
  const token = await getAccessToken(realm);
  const userId = await getUserIdByEmail(email, realm);
  const groupId = await getGroupIdByName(groupName, realm);

  if (!userId || !groupId) return;

  await fetch(`${process.env.KEYCLOAK_BASE_URL}/admin/realms/${realm}/users/${userId}/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
