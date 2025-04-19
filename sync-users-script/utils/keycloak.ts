import axios from 'axios';

export async function getAdminToken(): Promise<string> {
  const baseUrl = process.env.KEYCLOAK_BASE_URL!;
  const realm = process.env.KEYCLOAK_REALM!;
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET!;
  const username = process.env.KEYCLOAK_ADMIN_USERNAME!;
  const password = process.env.KEYCLOAK_ADMIN_PASSWORD!;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret); 
  params.append('username', username);
  params.append('password', password);
  params.append('grant_type', 'password');

  const res = await axios.post(
    `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return res.data.access_token;
}

