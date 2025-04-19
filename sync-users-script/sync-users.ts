import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { getAdminToken } from './utils/keycloak';



const supabaseUrl=process.env.SUPABASE_URL!;
const supabaseKey=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase=createClient(supabaseUrl,supabaseKey);


const KEYCLOAK_BASE_URL=process.env.KEYCLOAK_BASE_URL!;
const REALM=process.env.KEYCLOAK_REALM!;
const GROUP_NAME='members';


async function getDriveUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, access')
      .filter('access->>drive', 'neq', null);
      
    if (error) throw error;
  
    return data.map(user => ({
      ...user,
      username: user.email.split('@')[0]
    }));
  }
  
  async function getGroupId(token: string): Promise<string | null> {
    const res = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/groups`, {
      headers: {
        Authorization:` Bearer ${token}`,
      },
    });
  
    const groups = await res.json();
    console.log("DEBUG: groups raw response", groups); //*****control
    if (!Array.isArray(groups)) throw new Error('Invalid groups response');
    const group = groups.find((g: any) => g.name === GROUP_NAME);
    return group?.id ?? null;
  }
  
  async function getUsersInGroup(token: string, groupId: string): Promise<any[]> {
    const res = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (!res.ok) {
      console.error('Fallback: failed to fetch all users:', res.status, await res.text());
      return [];
    }
  
    const allUsers = await res.json();
    const members: any[] = [];
  
    for (const user of allUsers) {
      const groupRes = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${user.id}/groups`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const userGroups = await groupRes.json();
      if (Array.isArray(userGroups) && userGroups.some(g => g.id === groupId)) {
        members.push(user);
      }
    }
  
    return members;
}


export async function getOrCreateUserIdByUsername(token: string, user: { username: string; email: string; access: any }) {
    const res = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users?username=${user.username}`, {
      headers: {
        Authorization:` Bearer ${token}`,
      },
    });
    const data = await res.json();
  
    if (data.length > 0) {
      return data[0].id; 
    }

    console.log(`Creating user: ${user.username}`);
  
 
    const createUser = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users`, {
      method: 'POST',
      headers: {
        Authorization:` Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        enabled: true,
      }),
    });
  
    if (!createUser.ok) {
      console.error(`Could not create the user: ${user.username}`);
      return null;
    }

    const confirmUser = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users?username=${user.username}`, {
      headers: {
        Authorization:`Bearer ${token}`,
      },
    });
    const confirmData = await confirmUser.json();
    return confirmData.length > 0 ? confirmData[0].id : null;
  }




async function addUserToGroup(token: string, userId: string, groupId: string) {
    const response = await fetch(
      `${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${userId}/groups/${groupId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          realm: REALM,
          group: GROUP_NAME,
        }),
      }
    );
    if (!response.ok) {
        console.error(`Failed to add user ${userId} to group: ${response.statusText}`);
    }
    return response;
}



async function removeUserFromGroup(token: string, userId: string, groupId: string) {
    const res = await fetch(`${KEYCLOAK_BASE_URL}/admin/realms/${REALM}/users/${userId}/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res;
}
  


async function main() {
    try {
      const token = await getAdminToken();
      const usersFromSupabase = await getDriveUsers();
      const groupId = await getGroupId(token);
      if (!groupId) return console.error('Group not found');
  
      const keycloakGroupUsers = await getUsersInGroup(token, groupId);
      console.log("DEBUG: keycloakGroupUsers response", keycloakGroupUsers);//***controll */
      const supabaseUsernames = new Set(usersFromSupabase.map(u => u.username));
  
      for (const user of usersFromSupabase) {
        const userID = await getOrCreateUserIdByUsername(token, user);
        if (userID) {
          const addResponse = await addUserToGroup(token, userID, groupId);
          console.log(`${user.username} synced`, addResponse.status);
        }
      }
  
      for (const kcUser of keycloakGroupUsers) {
        if (!supabaseUsernames.has(kcUser.username)) {
          const removeResponse = await removeUserFromGroup(token, kcUser.id, groupId);
          console.log(`${kcUser.username} removed from group`,removeResponse.status);
        }
      }
    } catch (err) {
      console.error(' Something went wrong:', err);
    }
}
  
  
main();


