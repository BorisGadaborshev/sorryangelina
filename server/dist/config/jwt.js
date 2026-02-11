"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthToken = exports.signAuthToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const base64UrlEncode = (value) => Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const base64UrlDecode = (value) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, 'base64').toString('utf-8');
};
const signRaw = (input) => crypto_1.default.createHmac('sha256', JWT_SECRET).update(input).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const signAuthToken = (name, type) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        name,
        type,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = signRaw(`${encodedHeader}.${encodedPayload}`);
    const token = `${encodedHeader}.${encodedPayload}.${signature}`;
    return {
        token,
        expiresAt: payload.exp * 1000
    };
};
exports.signAuthToken = signAuthToken;
const verifyAuthToken = (token) => {
    if (!token)
        return null;
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = signRaw(`${encodedHeader}.${encodedPayload}`);
    if (signature !== expectedSignature)
        return null;
    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        if (!(payload === null || payload === void 0 ? void 0 : payload.name) || !(payload === null || payload === void 0 ? void 0 : payload.type) || !(payload === null || payload === void 0 ? void 0 : payload.exp) || !(payload === null || payload === void 0 ? void 0 : payload.iat)) {
            return null;
        }
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp <= now) {
            return null;
        }
        return payload;
    }
    catch (error) {
        return null;
    }
};
exports.verifyAuthToken = verifyAuthToken;
