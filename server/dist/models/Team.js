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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamModel = void 0;
const database_1 = require("../config/database");
exports.TeamModel = {
    create(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield database_1.pool.connect();
            try {
                yield client.query('BEGIN');
                yield client.query(`insert into teams (id, name, password_hash, owner) values ($1,$2,$3,$4)
         on conflict (id) do update set name = excluded.name, password_hash = excluded.password_hash, owner = excluded.owner, updated_at = now()`, [doc.id, doc.name, doc.passwordHash, doc.owner]);
                for (const member of doc.members) {
                    yield client.query(`insert into team_members (team_id, name, role) values ($1,$2,$3)
           on conflict (team_id, name) do update set role = excluded.role`, [doc.id, member.name, member.role]);
                }
                yield client.query('COMMIT');
                return doc;
            }
            catch (error) {
                yield client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        });
    },
    findOne(where) {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query('select id, name, password_hash, owner, created_at from teams where id=$1', [where.id]);
            if (rows.length === 0)
                return null;
            const teamRow = rows[0];
            const membersRes = yield database_1.pool.query('select team_id, name, role from team_members where team_id=$1 order by created_at asc', [where.id]);
            const members = membersRes.rows.map((member) => ({
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
        });
    },
    find() {
        return __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield database_1.pool.query('select id from teams order by created_at desc');
            const teams = [];
            for (const row of rows) {
                const team = yield this.findOne({ id: row.id });
                if (team)
                    teams.push(team);
            }
            return teams;
        });
    },
    addMember(teamId, name, role = 'user') {
        return __awaiter(this, void 0, void 0, function* () {
            yield database_1.pool.query(`insert into team_members (team_id, name, role) values ($1,$2,$3)
       on conflict (team_id, name) do nothing`, [teamId, name, role]);
            return this.findOne({ id: teamId });
        });
    }
};
