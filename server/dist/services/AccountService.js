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
exports.AccountService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const authNames_1 = require("../config/authNames");
class AccountService {
    static getFixedUsers() {
        return authNames_1.FIXED_AUTH_NAMES;
    }
    static fixedLogin(name, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedName = (0, authNames_1.normalizeAuthName)(name);
            if (!(0, authNames_1.isFixedAuthName)(normalizedName)) {
                throw new Error('Name is not in fixed list');
            }
            if (!password || password.length < 4) {
                throw new Error('Password must contain at least 4 characters');
            }
            const account = yield this.getAccountByName(normalizedName);
            if (!account) {
                const passwordHash = yield bcryptjs_1.default.hash(password, 10);
                yield database_1.pool.query(`insert into accounts (name, password_hash, type) values ($1, $2, $3)`, [normalizedName, passwordHash, 'fixed']);
                return {
                    profile: {
                        name: normalizedName,
                        type: 'fixed'
                    },
                    isFirstLogin: true
                };
            }
            const isValid = yield bcryptjs_1.default.compare(password, account.password_hash);
            if (!isValid) {
                throw new Error('Invalid password');
            }
            return {
                profile: {
                    name: normalizedName,
                    type: 'fixed'
                },
                isFirstLogin: false
            };
        });
    }
    static login(name, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedName = (0, authNames_1.normalizeAuthName)(name);
            if (!normalizedName) {
                throw new Error('Name is required');
            }
            if (!password) {
                throw new Error('Password is required');
            }
            const account = yield this.getAccountByName(normalizedName);
            if (!account) {
                throw new Error('Account not found');
            }
            const isValid = yield bcryptjs_1.default.compare(password, account.password_hash);
            if (!isValid) {
                throw new Error('Invalid password');
            }
            return {
                name: normalizedName,
                type: account.type
            };
        });
    }
    static register(name, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedName = (0, authNames_1.normalizeAuthName)(name);
            if (!normalizedName) {
                throw new Error('Name is required');
            }
            if (password.length < 4) {
                throw new Error('Password must contain at least 4 characters');
            }
            const existing = yield this.getAccountByName(normalizedName);
            if (existing) {
                throw new Error('Account already exists');
            }
            const passwordHash = yield bcryptjs_1.default.hash(password, 10);
            const type = (0, authNames_1.isFixedAuthName)(normalizedName) ? 'fixed' : 'registered';
            yield database_1.pool.query(`insert into accounts (name, password_hash, type) values ($1, $2, $3)`, [normalizedName, passwordHash, type]);
            return {
                name: normalizedName,
                type
            };
        });
    }
    static guestLogin(name) {
        const normalizedName = (0, authNames_1.normalizeAuthName)(name);
        if (!normalizedName) {
            throw new Error('Guest name is required');
        }
        return {
            name: normalizedName,
            type: 'guest'
        };
    }
    static getAccountByName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query(`select name, password_hash, type from accounts where lower(name) = lower($1) limit 1`, [name]);
            if (rows.length === 0) {
                return null;
            }
            return rows[0];
        });
    }
}
exports.AccountService = AccountService;
