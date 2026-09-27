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
exports.TeamService = exports.BUILTIN_TEAM_ID = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const Team_1 = require("../models/Team");
const authNames_1 = require("../config/authNames");
const AccountService_1 = require("./AccountService");
const ContentModeration_1 = require("./ContentModeration");
const UsageLimits_1 = require("./UsageLimits");
exports.BUILTIN_TEAM_ID = 'cards-partners';
const BUILTIN_TEAM_NAME = 'Карты и Партнеры';
const BUILTIN_TEAM_PASSWORD = '1395-5';
const BUILTIN_TEAM_OWNER = 'Коваль Ангелина Константиновна';
const slugifyTeamId = (name) => {
    const normalized = name.trim().toLowerCase();
    const latin = normalized.replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '');
    return latin || `team-${Date.now()}`;
};
class TeamService {
    static verifyBuiltinAccessCode(code) {
        return (code === null || code === void 0 ? void 0 : code.trim()) === BUILTIN_TEAM_PASSWORD;
    }
    static canAccessBuiltinRoster(auth, accessCode) {
        return (auth === null || auth === void 0 ? void 0 : auth.type) === 'fixed' || this.verifyBuiltinAccessCode(accessCode);
    }
    static ensureBuiltinTeam() {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield Team_1.TeamModel.findOne({ id: exports.BUILTIN_TEAM_ID });
            if (existing) {
                yield this.assignLegacyRoomsToBuiltinTeam();
                return this.convertToTeam(existing);
            }
            const passwordHash = yield bcryptjs_1.default.hash(BUILTIN_TEAM_PASSWORD, 10);
            const members = this.buildMembers(exports.BUILTIN_TEAM_ID, BUILTIN_TEAM_OWNER, authNames_1.FIXED_AUTH_NAMES, BUILTIN_TEAM_OWNER);
            const team = yield Team_1.TeamModel.create({
                id: exports.BUILTIN_TEAM_ID,
                name: BUILTIN_TEAM_NAME,
                passwordHash,
                passwordVersion: 1,
                owner: BUILTIN_TEAM_OWNER,
                members
            });
            yield this.assignLegacyRoomsToBuiltinTeam();
            return this.convertToTeam(team);
        });
    }
    static createTeam(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = input.name.trim();
            const password = input.password.trim();
            if (!name || !password) {
                throw new Error('Team name and password are required');
            }
            const owner = (0, authNames_1.normalizeAuthName)(input.owner);
            yield (0, UsageLimits_1.assertCreationSlotAvailable)(owner, 'team');
            const memberNames = Array.from(new Set([owner, ...(input.members || [])].map((memberName) => (0, authNames_1.normalizeAuthName)(memberName)).filter(Boolean)));
            yield (0, ContentModeration_1.assertNoProfanity)([
                { kind: 'team', text: name },
                ...memberNames.map((memberName) => ({ kind: 'person', text: memberName }))
            ]);
            yield this.ensureBuiltinTeam();
            const baseId = slugifyTeamId(name);
            let id = baseId;
            let suffix = 2;
            while (yield Team_1.TeamModel.findOne({ id })) {
                id = `${baseId}-${suffix}`;
                suffix += 1;
            }
            const passwordHash = yield bcryptjs_1.default.hash(password, 10);
            const members = this.buildMembers(id, owner, input.members, input.scrumMasterName);
            const team = yield Team_1.TeamModel.create({
                id,
                name,
                passwordHash,
                passwordVersion: 1,
                owner,
                members
            }, { enforceDailyLimit: true });
            yield Team_1.TeamModel.setMemberPasswordUnlock(id, owner, team.passwordVersion);
            return this.convertToTeam(team);
        });
    }
    static getAllTeams() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const teams = yield Team_1.TeamModel.find();
            return teams.map((team) => ({
                id: team.id,
                name: team.name,
                owner: team.owner,
                membersCount: team.members.length,
                createdAt: team.createdAt
            }));
        });
    }
    static getTeam(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            return team ? this.convertToTeam(team) : null;
        });
    }
    static unlockTeamRoster(teamId, password) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                throw new Error('Team not found');
            }
            const providedPassword = (password === null || password === void 0 ? void 0 : password.trim()) || '';
            if (!providedPassword) {
                throw new Error('Team password is required');
            }
            const isValid = yield bcryptjs_1.default.compare(providedPassword, team.passwordHash);
            if (!isValid) {
                throw new Error('Invalid team password');
            }
            return this.getTeamRosterNames(teamId);
        });
    }
    static joinTeam(teamId, password, username) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                throw new Error('Team not found');
            }
            const providedPassword = (password === null || password === void 0 ? void 0 : password.trim()) || '';
            if (!providedPassword) {
                if (yield this.hasUnlockedTeamPassword(team, username)) {
                    return this.convertToTeam(team);
                }
                throw new Error('Team password is required');
            }
            const isValid = yield bcryptjs_1.default.compare(providedPassword, team.passwordHash);
            if (!isValid) {
                throw new Error('Invalid team password');
            }
            return this.joinTeamAsMember(teamId, username, team.passwordVersion);
        });
    }
    static joinBuiltinTeamForFixedUser(username) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: exports.BUILTIN_TEAM_ID });
            if (!team) {
                throw new Error('Team not found');
            }
            return this.joinTeamAsMember(exports.BUILTIN_TEAM_ID, username, team.passwordVersion);
        });
    }
    static hasUnlockedTeamPassword(team, username) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedName = (0, authNames_1.normalizeAuthName)(username);
            if (!this.isTeamMember(team, normalizedName)) {
                return false;
            }
            const passwordVersion = 'passwordVersion' in team
                ? team.passwordVersion
                : (_a = (yield Team_1.TeamModel.findOne({ id: team.id }))) === null || _a === void 0 ? void 0 : _a.passwordVersion;
            if (!passwordVersion) {
                return false;
            }
            const unlockedVersion = yield Team_1.TeamModel.getMemberPasswordUnlock(team.id, normalizedName);
            return unlockedVersion === passwordVersion;
        });
    }
    static changeTeamPassword(teamId, actorName, password) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                throw new Error('Team not found');
            }
            if (!this.isTeamAdmin(team, actorName)) {
                throw new Error('Только админ команды может менять пароль');
            }
            const nextPassword = password.trim();
            if (!nextPassword) {
                throw new Error('Team password is required');
            }
            const passwordHash = yield bcryptjs_1.default.hash(nextPassword, 10);
            const updatedTeam = yield Team_1.TeamModel.updatePassword(teamId, passwordHash);
            if (!updatedTeam) {
                throw new Error('Failed to update team password');
            }
            yield Team_1.TeamModel.setMemberPasswordUnlock(teamId, (0, authNames_1.normalizeAuthName)(actorName), updatedTeam.passwordVersion);
            return this.convertToTeam(updatedTeam);
        });
    }
    static joinTeamAsMember(teamId, username, passwordVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                throw new Error('Team not found');
            }
            const normalizedName = (0, authNames_1.normalizeAuthName)(username);
            const existingMember = team.members.find((member) => member.name === normalizedName);
            if (!existingMember) {
                const updatedTeam = yield Team_1.TeamModel.addMember(teamId, normalizedName, 'user');
                if (!updatedTeam) {
                    throw new Error('Failed to join team');
                }
                yield Team_1.TeamModel.setMemberPasswordUnlock(teamId, normalizedName, passwordVersion);
                return this.convertToTeam(updatedTeam);
            }
            yield Team_1.TeamModel.setMemberPasswordUnlock(teamId, normalizedName, passwordVersion);
            return this.convertToTeam(team);
        });
    }
    static getTeamRosterNames(teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            if (teamId === exports.BUILTIN_TEAM_ID) {
                return [...authNames_1.FIXED_AUTH_NAMES];
            }
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                return [];
            }
            return team.members.map((member) => member.name);
        });
    }
    static getUserRole(teamId, username) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team)
                return null;
            const normalizedName = (0, authNames_1.normalizeAuthName)(username);
            return ((_a = team.members.find((member) => member.name === normalizedName)) === null || _a === void 0 ? void 0 : _a.role) || null;
        });
    }
    static isTeamAdmin(team, username) {
        const normalizedName = (0, authNames_1.normalizeAuthName)(username);
        if (team.owner === normalizedName)
            return true;
        return team.members.some((member) => member.name === normalizedName && member.role === 'admin');
    }
    static isTeamMember(team, username) {
        const normalizedName = (0, authNames_1.normalizeAuthName)(username);
        return team.members.some((member) => member.name === normalizedName);
    }
    static removeMember(teamId, actorName, memberName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                throw new Error('Team not found');
            }
            if (!this.isTeamAdmin(team, actorName)) {
                throw new Error('Только админ команды может удалять участников');
            }
            const normalizedMemberName = (0, authNames_1.normalizeAuthName)(memberName);
            if (!normalizedMemberName) {
                throw new Error('Укажите имя участника');
            }
            if (normalizedMemberName === team.owner) {
                throw new Error('Нельзя удалить создателя команды');
            }
            if (!this.isTeamMember(team, normalizedMemberName)) {
                throw new Error('Участник не найден');
            }
            const updatedTeam = yield Team_1.TeamModel.removeMember(teamId, normalizedMemberName);
            if (!updatedTeam) {
                throw new Error('Failed to remove member');
            }
            return this.convertToTeam(updatedTeam);
        });
    }
    static resetMemberPassword(teamId, actorName, memberName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureBuiltinTeam();
            const team = yield Team_1.TeamModel.findOne({ id: teamId });
            if (!team) {
                throw new Error('Team not found');
            }
            if (!this.isTeamAdmin(team, actorName)) {
                throw new Error('Только админ команды может сбрасывать пароли');
            }
            const normalizedMemberName = (0, authNames_1.normalizeAuthName)(memberName);
            if (!this.isTeamMember(team, normalizedMemberName)) {
                throw new Error('Участник не найден');
            }
            const password = yield AccountService_1.AccountService.resetPassword(normalizedMemberName);
            return {
                team: this.convertToTeam(team),
                password
            };
        });
    }
    static buildMembers(teamId, owner, members, scrumMasterName) {
        const names = Array.from(new Set([owner, ...members].map((name) => (0, authNames_1.normalizeAuthName)(name)).filter(Boolean)));
        const normalizedScrumMaster = scrumMasterName ? (0, authNames_1.normalizeAuthName)(scrumMasterName) : '';
        const adminName = normalizedScrumMaster && names.includes(normalizedScrumMaster) ? normalizedScrumMaster : owner;
        return names.map((name) => ({
            teamId,
            name,
            role: name === adminName ? 'admin' : 'user'
        }));
    }
    static convertToTeam(doc) {
        return {
            id: doc.id,
            name: doc.name,
            owner: doc.owner,
            createdAt: doc.createdAt,
            members: doc.members
        };
    }
    static assignLegacyRoomsToBuiltinTeam() {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query('update rooms set team_id=$1 where team_id is null', [exports.BUILTIN_TEAM_ID]);
        });
    }
}
exports.TeamService = TeamService;
