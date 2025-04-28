import { disableNextcloudUser, enableNextcloudUser } from '@/lib/nextcloud';
import { createClient } from '@supabase/supabase-js';
import {
  addUserToGroup,
  createOrUpdateKeycloakUser,
  getAllRealmGroups,
  getUserGroups,
  removeUserFromGroup,
} from './keycloak';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REALMS = ['prt', 'wiki'] as const;

async function getUsersFromSupabase() {
  const { data, error } = await supabase
    .from('users')
    .select('email, access, first_name, last_name');

  if (error) throw error;
  return data;
}

export async function syncUsers() {
  const users = await getUsersFromSupabase();

  for (const user of users) {
    const { email, access, first_name, last_name } = user;
    if (!email) continue;

    const accessIsEmpty =
      !access ||
      Object.values(access).every((val) => !Array.isArray(val) || val.length === 0);

    for (const realm of REALMS) {
      await createOrUpdateKeycloakUser(email, realm, first_name, last_name);

      const currentGroups = new Set(await getUserGroups(email, realm));

      
      if (accessIsEmpty) {
        for (const group of currentGroups) {
          console.log(`[${realm}] ${email} remove from "${group}"`);
          await removeUserFromGroup(email, group, realm);
        }
        continue;
      }

      const realmAccess = access[realm === 'prt' ? 'drive' : 'wiki'] || [];
      const requiredGroups = new Set<string>(realmAccess);

      
      const allGroups = await getAllRealmGroups(realm);
      const allGroupNames = new Set(allGroups.map((g: any) => g.name));

      for (const group of requiredGroups) {
        if (!allGroupNames.has(group)) {
          console.log(`[${realm}] Group "${group}" not found. Creating`);
        }

        await addUserToGroup(email, group, realm);
      }

      
      const toRemove = [...currentGroups].filter((g) => !requiredGroups.has(g));
      for (const group of toRemove) {
        console.log(`[${realm}] ${email}  remove from "${group}"`);
        await removeUserFromGroup(email, group, realm);
      }
    }
    const prtGroups = await getUserGroups(email, 'prt');
    const wikiGroups = await getUserGroups(email, 'wiki');

    if (prtGroups.length === 0 && wikiGroups.length === 0) {
      console.log(`[nextcloud] ${email} removed from all groups. Account is being disabled.`);
      await disableNextcloudUser(email);
    } else {
      console.log(`[nextcloud] ${email} has active groups. Account is being activated.`);
      await enableNextcloudUser(email);
    }
  }

  return {
    message: 'Sync completed successfully',
    userCount: users.length,
  };
}
