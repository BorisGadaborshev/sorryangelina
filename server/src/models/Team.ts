import { pool } from '../config/database';
import { TeamDocument, TeamMember } from '../types';

export const TeamModel = {
  async create(doc: TeamDocument): Promise<TeamDocument> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `insert into teams (id, name, password_hash, owner) values ($1,$2,$3,$4)
         on conflict (id) do update set name = excluded.name, password_hash = excluded.password_hash, owner = excluded.owner, updated_at = now()`,
        [doc.id, doc.name, doc.passwordHash, doc.owner]
      );

      for (const member of doc.members) {
        await client.query(
          `insert into team_members (team_id, name, role) values ($1,$2,$3)
           on conflict (team_id, name) do update set role = excluded.role`,
          [doc.id, member.name, member.role]
        );
      }

      await client.query('COMMIT');
      return doc;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async findOne(where: { id: string }): Promise<TeamDocument | null> {
    const { rows } = await pool.query('select id, name, password_hash, owner, created_at from teams where id=$1', [where.id]);
    if (rows.length === 0) return null;

    const teamRow = rows[0] as { id: string; name: string; password_hash: string; owner: string; created_at: string };
    const membersRes = await pool.query('select team_id, name, role from team_members where team_id=$1 order by created_at asc', [where.id]);
    const members = (membersRes.rows as Array<{ team_id: string; name: string; role: TeamMember['role'] }>).map((member) => ({
      teamId: member.team_id,
      name: member.name,
      role: member.role
    }));

    return {
      id: teamRow.id,
      name: teamRow.name,
      passwordHash: teamRow.password_hash,
      owner: teamRow.owner,
      createdAt: teamRow.created_at,
      members
    };
  },

  async find(): Promise<TeamDocument[]> {
    const { rows } = await pool.query('select id from teams order by created_at desc');
    const teams: TeamDocument[] = [];
    for (const row of rows as Array<{ id: string }>) {
      const team = await this.findOne({ id: row.id });
      if (team) teams.push(team);
    }
    return teams;
  },

  async addMember(teamId: string, name: string, role: TeamMember['role'] = 'user'): Promise<TeamDocument | null> {
    await pool.query(
      `insert into team_members (team_id, name, role) values ($1,$2,$3)
       on conflict (team_id, name) do nothing`,
      [teamId, name, role]
    );
    return this.findOne({ id: teamId });
  }
};
