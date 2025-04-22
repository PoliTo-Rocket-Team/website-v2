import { createClient } from '@supabase/supabase-js';
import {
  addUserToGroup,
  createOrUpdateKeycloakUser,
  getUserGroups,
  removeUserFromGroup,
} from './keycloak';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REALM_GROUP_MAP = {
  prt: {
    drive: {
      heads: 'heads',
      leads: 'leads',
    },
  },
  wiki: {
    wiki: {
      general: 'general',
    },
  },
} as const;

async function getUsersFromSupabase() {
  const { data, error } = await supabase
    .from('users')
    .select('email, access');

  if (error) throw error;
  return data;
}

export async function syncUsers() {
  const users = await getUsersFromSupabase();

  for (const user of users) {
    const email = user.email;
    const access = user.access;
    if (!email || !access) continue;

    for (const realm of Object.keys(REALM_GROUP_MAP) as (keyof typeof REALM_GROUP_MAP)[]) {
      const services = REALM_GROUP_MAP[realm];
      const requiredGroups = new Set<string>();
      const knownGroups = new Set<string>();

      for (const key of Object.keys(services)) {
        const groupMap = services[key as keyof typeof services];
        const accessValues = access[key];

        for (const val of Object.keys(groupMap)) {
          knownGroups.add(groupMap[val as keyof typeof groupMap]);
        }

        if (Array.isArray(accessValues)) {
          for (const val of accessValues) {
            const group = groupMap[val as keyof typeof groupMap];
            if (group) requiredGroups.add(group);
          }
        }
      }

      await createOrUpdateKeycloakUser(email, realm);
      const currentGroups = new Set(await getUserGroups(email, realm));

      const toAdd = [...requiredGroups].filter(g => !currentGroups.has(g));
      const toRemove = [...currentGroups].filter(
        g => knownGroups.has(g) && !requiredGroups.has(g)
      );

      for (const group of toAdd) {
        console.log(`→ [${realm}] ${email} → add to "${group}"`);
        await addUserToGroup(email, group, realm);
      }

      for (const group of toRemove) {
        console.log(`← [${realm}] ${email} → remove from "${group}"`);
        await removeUserFromGroup(email, group, realm);
      }
    }
  }

  return {
    message: 'Sync completed successfully',
    userCount: users.length,
  };
}
