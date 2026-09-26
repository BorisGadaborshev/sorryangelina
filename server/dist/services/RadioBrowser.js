"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomRadioStation = void 0;
const https_1 = __importDefault(require("https"));
const FALLBACK_MIRRORS = [
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info'
];
const REQUEST_HEADERS = {
    'User-Agent': 'SorryAngelina/1.15 (timer-music-widget)',
    Accept: 'application/json'
};
const fetchJson = (url, timeoutMs = 10000) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = new URL(url);
    return new Promise((resolve, reject) => {
        const request = https_1.default.get({
            hostname: parsed.hostname,
            path: `${parsed.pathname}${parsed.search}`,
            headers: REQUEST_HEADERS,
            family: 4,
            timeout: timeoutMs
        }, (response) => {
            var _a;
            const status = (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0;
            if (status < 200 || status >= 300) {
                response.resume();
                reject(new Error(`Radio-Browser HTTP ${status}`));
                return;
            }
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                }
                catch (error) {
                    reject(error);
                }
            });
        });
        request.on('timeout', () => {
            request.destroy(new Error('Radio-Browser timeout'));
        });
        request.on('error', reject);
    });
});
const getMirrors = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const servers = yield fetchJson('https://all.api.radio-browser.info/json/servers', 5000);
        const unique = [...new Set(servers.map((server) => server.name).filter(Boolean))];
        if (unique.length) {
            return unique.map((name) => `https://${name}`);
        }
    }
    catch (_a) {
        // Fall back to known mirrors.
    }
    return FALLBACK_MIRRORS;
});
const getRandomRadioStation = () => __awaiter(void 0, void 0, void 0, function* () {
    const mirrors = yield getMirrors();
    let lastError;
    for (const mirror of mirrors) {
        try {
            const query = new URLSearchParams({
                hidebroken: 'true',
                limit: '8',
                order: 'random',
                codec: 'MP3'
            });
            const stations = yield fetchJson(`${mirror}/json/stations/search?${query.toString()}`);
            const playable = stations.filter((station) => station.stationuuid && (station.url_resolved || station.url));
            if (!playable.length) {
                throw new Error('No playable stations');
            }
            const picked = playable[Math.floor(Math.random() * playable.length)];
            let streamUrl = picked.url_resolved || picked.url;
            try {
                const resolved = yield fetchJson(`${mirror}/json/url/${picked.stationuuid}`, 5000);
                if (resolved.url) {
                    streamUrl = resolved.url;
                }
            }
            catch (_b) {
                // Keep the original stream URL if click-resolve fails.
            }
            return {
                uuid: picked.stationuuid,
                name: picked.name.trim() || 'Radio-Browser',
                url: streamUrl,
                favicon: picked.favicon,
                country: picked.country
            };
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Radio-Browser unavailable');
});
exports.getRandomRadioStation = getRandomRadioStation;
