// Thin fetch-based Okta REST API client

export interface OktaClientConfig {
  domain: string; // e.g. "dev-12345.okta.com"
  token: string; // SSWS API token
  rateLimit?: number; // requests per second, default 10
}

export interface OktaApiUser {
  id: string;
  status: string; // "ACTIVE" | "INACTIVE" | "DEPROVISIONED" | "SUSPENDED" | "LOCKED_OUT" | "PASSWORD_EXPIRED"
  created: string;
  lastUpdated: string;
  lastLogin?: string;
  profile: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    department?: string;
    title?: string;
    manager?: string;
    managerId?: string;
    employeeNumber?: string;
    organization?: string;
    mobilePhone?: string;
    primaryPhone?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    countryCode?: string;
  };
}

export interface OktaApiGroup {
  id: string;
  type: string;
  lastUpdated: string;
  lastMembershipUpdated: string;
  profile: {
    name: string;
    description?: string;
  };
}

function parseLinkHeader(header: string): Map<string, string> {
  const links = new Map<string, string>();
  const parts = header.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const url = match[1];
      const rel = match[2];
      if (url && rel) {
        links.set(rel, url);
      }
    }
  }
  return links;
}

export class OktaClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly minIntervalMs: number;

  constructor(config: OktaClientConfig) {
    this.baseUrl = `https://${config.domain}`;
    this.headers = {
      Authorization: `SSWS ${config.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const rateLimit = config.rateLimit ?? 10;
    this.minIntervalMs = Math.ceil(1000 / rateLimit);
  }

  private async get<T>(url: string): Promise<{ data: T; nextUrl: string | null }> {
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Okta API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as T;

    const linkHeader = response.headers.get("link");
    let nextUrl: string | null = null;
    if (linkHeader) {
      const links = parseLinkHeader(linkHeader);
      nextUrl = links.get("next") ?? null;
    }

    return { data, nextUrl };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  async *listUsers(filter?: string): AsyncGenerator<OktaApiUser> {
    let url: string | null = `${this.baseUrl}/api/v1/users?limit=200`;
    if (filter) {
      url += `&filter=${encodeURIComponent(filter)}`;
    }

    while (url) {
      const { data, nextUrl } = await this.get<OktaApiUser[]>(url);
      for (const user of data) {
        yield user;
      }
      url = nextUrl;
      if (url) {
        await this.sleep(this.minIntervalMs);
      }
    }
  }

  async getUser(userId: string): Promise<OktaApiUser> {
    const url = `${this.baseUrl}/api/v1/users/${encodeURIComponent(userId)}`;
    const { data } = await this.get<OktaApiUser>(url);
    return data;
  }

  async getUserGroups(userId: string): Promise<OktaApiGroup[]> {
    const url = `${this.baseUrl}/api/v1/users/${encodeURIComponent(userId)}/groups`;
    const { data } = await this.get<OktaApiGroup[]>(url);
    return data;
  }

  async *listGroups(): AsyncGenerator<OktaApiGroup> {
    let url: string | null = `${this.baseUrl}/api/v1/groups?limit=200`;

    while (url) {
      const { data, nextUrl } = await this.get<OktaApiGroup[]>(url);
      for (const group of data) {
        yield group;
      }
      url = nextUrl;
      if (url) {
        await this.sleep(this.minIntervalMs);
      }
    }
  }

  async *listGroupMembers(groupId: string): AsyncGenerator<OktaApiUser> {
    let url: string | null = `${this.baseUrl}/api/v1/groups/${encodeURIComponent(groupId)}/users?limit=200`;

    while (url) {
      const { data, nextUrl } = await this.get<OktaApiUser[]>(url);
      for (const user of data) {
        yield user;
      }
      url = nextUrl;
      if (url) {
        await this.sleep(this.minIntervalMs);
      }
    }
  }
}
