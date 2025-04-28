export async function disableNextcloudUser(username: string) {
    const res = await fetch(`${process.env.NEXTCLOUD_BASE_URL}/ocs/v1.php/cloud/users/${username}/disable`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.NEXTCLOUD_ADMIN_USER}:${process.env.NEXTCLOUD_ADMIN_PASSWORD}`).toString('base64')}`,
        'OCS-APIRequest': 'true',
      },
    });
  
    if (!res.ok) {
      console.error(`[nextcloud] Failed to disable user ${username}: ${res.status} ${res.statusText}`);
    }
  }
  
  export async function enableNextcloudUser(username: string) {
    const res = await fetch(`${process.env.NEXTCLOUD_BASE_URL}/ocs/v1.php/cloud/users/${username}/enable`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.NEXTCLOUD_ADMIN_USER}:${process.env.NEXTCLOUD_ADMIN_PASSWORD}`).toString('base64')}`,
        'OCS-APIRequest': 'true',
      },
    });
  
    if (!res.ok) {
      console.error(`[nextcloud] Failed to enable user ${username}: ${res.status} ${res.statusText}`);
    }
  }
  