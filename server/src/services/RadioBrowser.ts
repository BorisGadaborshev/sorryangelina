import https from 'https';

export interface RadioStation {
  uuid: string;
  name: string;
  url: string;
  favicon?: string;
  country?: string;
}

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  favicon?: string;
  country?: string;
}

interface RadioBrowserClickResponse {
  url?: string;
}

interface RadioBrowserServer {
  name: string;
}

const FALLBACK_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info'
];

const REQUEST_HEADERS = {
  'User-Agent': 'SorryAngelina/1.15 (timer-music-widget)',
  Accept: 'application/json'
};

const fetchJson = async <T>(url: string, timeoutMs = 10000): Promise<T> => {
  const parsed = new URL(url);

  return new Promise<T>((resolve, reject) => {
    const request = https.get({
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      headers: REQUEST_HEADERS,
      family: 4,
      timeout: timeoutMs
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Radio-Browser HTTP ${status}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk as Buffer));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Radio-Browser timeout'));
    });
    request.on('error', reject);
  });
};

const getMirrors = async (): Promise<string[]> => {
  try {
    const servers = await fetchJson<RadioBrowserServer[]>(
      'https://all.api.radio-browser.info/json/servers',
      5000
    );
    const unique = [...new Set(servers.map((server) => server.name).filter(Boolean))];
    if (unique.length) {
      return unique.map((name) => `https://${name}`);
    }
  } catch {
    // Fall back to known mirrors.
  }
  return FALLBACK_MIRRORS;
};

export const getRandomRadioStation = async (): Promise<RadioStation> => {
  const mirrors = await getMirrors();
  let lastError: unknown;

  for (const mirror of mirrors) {
    try {
      const query = new URLSearchParams({
        hidebroken: 'true',
        limit: '8',
        order: 'random',
        codec: 'MP3'
      });
      const stations = await fetchJson<RadioBrowserStation[]>(
        `${mirror}/json/stations/search?${query.toString()}`
      );
      const playable = stations.filter((station) => station.stationuuid && (station.url_resolved || station.url));
      if (!playable.length) {
        throw new Error('No playable stations');
      }

      const picked = playable[Math.floor(Math.random() * playable.length)];
      let streamUrl = picked.url_resolved || picked.url;

      try {
        const resolved = await fetchJson<RadioBrowserClickResponse>(`${mirror}/json/url/${picked.stationuuid}`, 5000);
        if (resolved.url) {
          streamUrl = resolved.url;
        }
      } catch {
        // Keep the original stream URL if click-resolve fails.
      }

      return {
        uuid: picked.stationuuid,
        name: picked.name.trim() || 'Radio-Browser',
        url: streamUrl,
        favicon: picked.favicon,
        country: picked.country
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Radio-Browser unavailable');
};
