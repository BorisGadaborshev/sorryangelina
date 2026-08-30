import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { TeamModel } from '../models/Team';
import { AvailableTeam, CreateTeamInput, Team, TeamDocument, TeamMember } from '../types';
import { FIXED_AUTH_NAMES, normalizeAuthName } from '../config/authNames';
import { AccountService } from './AccountService';

export const BUILTIN_TEAM_ID = 'cards-partners';
const BUILTIN_TEAM_NAME = 'Карты и Партнеры';
const BUILTIN_TEAM_PASSWORD = '1395-5';
const BUILTIN_TEAM_OWNER = 'Коваль Ангелина Константиновна';

const slugifyTeamId = (name: string): string => {
  const normalized = name.trim().toLowerCase();
  const latin = normalized.replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '');
  return latin || `team-${Date.now()}`;
};

export class TeamService {
  static verifyBuiltinAccessCode(code: string | undefined): boolean {
    return code?.trim() === BUILTIN_TEAM_PASSWORD;
  }

  static canAccessBuiltinRoster(auth: { type: string } | null, accessCode?: string): boolean {
    return auth?.type === 'fixed' || this.verifyBuiltinAccessCode(accessCode);
  }

  static async ensureBuiltinTeam(): Promise<Team> {
    const existing = await TeamModel.findOne({ id: BUILTIN_TEAM_ID });
    if (existing) {
      await this.assignLegacyRoomsToBuiltinTeam();
      return this.convertToTeam(existing);
    }

    const passwordHash = await bcrypt.hash(BUILTIN_TEAM_PASSWORD, 10);
    const members = this.buildMembers(BUILTIN_TEAM_ID, BUILTIN_TEAM_OWNER, FIXED_AUTH_NAMES, BUILTIN_TEAM_OWNER);
    const team = await TeamModel.create({
      id: BUILTIN_TEAM_ID,
      name: BUILTIN_TEAM_NAME,
      passwordHash,
      passwordVersion: 1,
      owner: BUILTIN_TEAM_OWNER,
      members
    });
    await this.assignLegacyRoomsToBuiltinTeam();
    return this.convertToTeam(team);
  }

  static async createTeam(input: CreateTeamInput): Promise<Team> {
    const name = input.name.trim();
    const password = input.password.trim();
    if (!name || !password) {
      throw new Error('Team name and password are required');
    }

    await this.ensureBuiltinTeam();

    const baseId = slugifyTeamId(name);
    let id = baseId;
    let suffix = 2;
    while (await TeamModel.findOne({ id })) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const owner = normalizeAuthName(input.owner);
    const members = this.buildMembers(id, owner, input.members, input.scrumMasterName);
    const team = await TeamModel.create({
      id,
      name,
      passwordHash,
      passwordVersion: 1,
      owner,
      members
    });
    await TeamModel.setMemberPasswordUnlock(id, owner, team.passwordVersion);

    return this.convertToTeam(team);
  }

  static async getAllTeams(): Promise<AvailableTeam[]> {
    await this.ensureBuiltinTeam();
    const teams = await TeamModel.find();
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      owner: team.owner,
      membersCount: team.members.length,
      createdAt: team.createdAt
    }));
  }

  static async getTeam(teamId: string): Promise<Team | null> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    return team ? this.convertToTeam(team) : null;
  }

  static async unlockTeamRoster(teamId: string, password: string | undefined): Promise<string[]> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }

    const providedPassword = password?.trim() || '';
    if (!providedPassword) {
      throw new Error('Team password is required');
    }

    const isValid = await bcrypt.compare(providedPassword, team.passwordHash);
    if (!isValid) {
      throw new Error('Invalid team password');
    }

    return this.getTeamRosterNames(teamId);
  }

  static async joinTeam(teamId: string, password: string | undefined, username: string): Promise<Team> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }

    const providedPassword = password?.trim() || '';
    if (!providedPassword) {
      if (await this.hasUnlockedTeamPassword(team, username)) {
        return this.convertToTeam(team);
      }
      throw new Error('Team password is required');
    }

    const isValid = await bcrypt.compare(providedPassword, team.passwordHash);
    if (!isValid) {
      throw new Error('Invalid team password');
    }

    return this.joinTeamAsMember(teamId, username, team.passwordVersion);
  }

  static async joinBuiltinTeamForFixedUser(username: string): Promise<Team> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: BUILTIN_TEAM_ID });
    if (!team) {
      throw new Error('Team not found');
    }
    return this.joinTeamAsMember(BUILTIN_TEAM_ID, username, team.passwordVersion);
  }

  static async hasUnlockedTeamPassword(team: TeamDocument | Team, username: string): Promise<boolean> {
    const normalizedName = normalizeAuthName(username);
    if (!this.isTeamMember(team, normalizedName)) {
      return false;
    }
    const passwordVersion = 'passwordVersion' in team
      ? team.passwordVersion
      : (await TeamModel.findOne({ id: team.id }))?.passwordVersion;
    if (!passwordVersion) {
      return false;
    }
    const unlockedVersion = await TeamModel.getMemberPasswordUnlock(team.id, normalizedName);
    return unlockedVersion === passwordVersion;
  }

  static async changeTeamPassword(teamId: string, actorName: string, password: string): Promise<Team> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
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

    const passwordHash = await bcrypt.hash(nextPassword, 10);
    const updatedTeam = await TeamModel.updatePassword(teamId, passwordHash);
    if (!updatedTeam) {
      throw new Error('Failed to update team password');
    }
    await TeamModel.setMemberPasswordUnlock(teamId, normalizeAuthName(actorName), updatedTeam.passwordVersion);
    return this.convertToTeam(updatedTeam);
  }

  private static async joinTeamAsMember(teamId: string, username: string, passwordVersion: number): Promise<Team> {
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }

    const normalizedName = normalizeAuthName(username);
    const existingMember = team.members.find((member) => member.name === normalizedName);
    if (!existingMember) {
      const updatedTeam = await TeamModel.addMember(teamId, normalizedName, 'user');
      if (!updatedTeam) {
        throw new Error('Failed to join team');
      }
      await TeamModel.setMemberPasswordUnlock(teamId, normalizedName, passwordVersion);
      return this.convertToTeam(updatedTeam);
    }

    await TeamModel.setMemberPasswordUnlock(teamId, normalizedName, passwordVersion);
    return this.convertToTeam(team);
  }

  static async getTeamRosterNames(teamId: string): Promise<string[]> {
    await this.ensureBuiltinTeam();
    if (teamId === BUILTIN_TEAM_ID) {
      return [...FIXED_AUTH_NAMES];
    }

    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      return [];
    }

    return team.members.map((member) => member.name);
  }

  static async getUserRole(teamId: string, username: string): Promise<TeamMember['role'] | null> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) return null;
    const normalizedName = normalizeAuthName(username);
    return team.members.find((member) => member.name === normalizedName)?.role || null;
  }

  static isTeamAdmin(team: TeamDocument | Team, username: string): boolean {
    const normalizedName = normalizeAuthName(username);
    if (team.owner === normalizedName) return true;
    return team.members.some((member) => member.name === normalizedName && member.role === 'admin');
  }

  static isTeamMember(team: TeamDocument | Team, username: string): boolean {
    const normalizedName = normalizeAuthName(username);
    return team.members.some((member) => member.name === normalizedName);
  }

  static async removeMember(teamId: string, actorName: string, memberName: string): Promise<Team> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }
    if (!this.isTeamAdmin(team, actorName)) {
      throw new Error('Только админ команды может удалять участников');
    }

    const normalizedMemberName = normalizeAuthName(memberName);
    if (!normalizedMemberName) {
      throw new Error('Укажите имя участника');
    }
    if (normalizedMemberName === team.owner) {
      throw new Error('Нельзя удалить создателя команды');
    }
    if (!this.isTeamMember(team, normalizedMemberName)) {
      throw new Error('Участник не найден');
    }

    const updatedTeam = await TeamModel.removeMember(teamId, normalizedMemberName);
    if (!updatedTeam) {
      throw new Error('Failed to remove member');
    }
    return this.convertToTeam(updatedTeam);
  }

  static async resetMemberPassword(teamId: string, actorName: string, memberName: string): Promise<{ team: Team; password: string }> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }
    if (!this.isTeamAdmin(team, actorName)) {
      throw new Error('Только админ команды может сбрасывать пароли');
    }

    const normalizedMemberName = normalizeAuthName(memberName);
    if (!this.isTeamMember(team, normalizedMemberName)) {
      throw new Error('Участник не найден');
    }

    const password = await AccountService.resetPassword(normalizedMemberName);
    return {
      team: this.convertToTeam(team),
      password
    };
  }

  private static buildMembers(teamId: string, owner: string, members: string[], scrumMasterName?: string): TeamMember[] {
    const names = Array.from(
      new Set([owner, ...members].map((name) => normalizeAuthName(name)).filter(Boolean))
    );
    const normalizedScrumMaster = scrumMasterName ? normalizeAuthName(scrumMasterName) : '';
    const adminName = normalizedScrumMaster && names.includes(normalizedScrumMaster) ? normalizedScrumMaster : owner;

    return names.map((name) => ({
      teamId,
      name,
      role: name === adminName ? 'admin' : 'user'
    }));
  }

  private static convertToTeam(doc: TeamDocument): Team {
    return {
      id: doc.id,
      name: doc.name,
      owner: doc.owner,
      createdAt: doc.createdAt,
      members: doc.members
    };
  }

  private static async assignLegacyRoomsToBuiltinTeam(): Promise<void> {
    await pool.query('update rooms set team_id=$1 where team_id is null', [BUILTIN_TEAM_ID]);
  }
}
