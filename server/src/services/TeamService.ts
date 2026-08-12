import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { TeamModel } from '../models/Team';
import { AvailableTeam, CreateTeamInput, Team, TeamDocument, TeamMember } from '../types';
import { FIXED_AUTH_NAMES, normalizeAuthName } from '../config/authNames';

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
      await this.syncBuiltinTeamMembers();
      await this.assignLegacyRoomsToBuiltinTeam();
      return this.convertToTeam((await TeamModel.findOne({ id: BUILTIN_TEAM_ID }))!);
    }

    const passwordHash = await bcrypt.hash(BUILTIN_TEAM_PASSWORD, 10);
    const members = this.buildMembers(BUILTIN_TEAM_ID, BUILTIN_TEAM_OWNER, FIXED_AUTH_NAMES, BUILTIN_TEAM_OWNER);
    const team = await TeamModel.create({
      id: BUILTIN_TEAM_ID,
      name: BUILTIN_TEAM_NAME,
      passwordHash,
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
      owner,
      members
    });

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

  static async joinTeam(teamId: string, password: string, username: string): Promise<Team> {
    await this.ensureBuiltinTeam();
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }

    const isValid = await bcrypt.compare(password, team.passwordHash);
    if (!isValid) {
      throw new Error('Invalid team password');
    }

    return this.joinTeamAsMember(teamId, username);
  }

  static async joinBuiltinTeamForFixedUser(username: string): Promise<Team> {
    await this.ensureBuiltinTeam();
    return this.joinTeamAsMember(BUILTIN_TEAM_ID, username);
  }

  private static async joinTeamAsMember(teamId: string, username: string): Promise<Team> {
    const team = await TeamModel.findOne({ id: teamId });
    if (!team) {
      throw new Error('Team not found');
    }

    const normalizedName = normalizeAuthName(username);
    const existingMember = team.members.find((member) => member.name === normalizedName);
    if (existingMember) {
      return this.convertToTeam(team);
    }

    const updatedTeam = await TeamModel.addMember(teamId, normalizedName, 'user');
    if (!updatedTeam) {
      throw new Error('Failed to join team');
    }
    return this.convertToTeam(updatedTeam);
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

  private static async syncBuiltinTeamMembers(): Promise<void> {
    const team = await TeamModel.findOne({ id: BUILTIN_TEAM_ID });
    if (!team) return;

    const existingNames = new Set(team.members.map((member) => member.name));
    for (const name of FIXED_AUTH_NAMES) {
      if (!existingNames.has(name)) {
        await TeamModel.addMember(BUILTIN_TEAM_ID, name, 'user');
      }
    }
  }
}
