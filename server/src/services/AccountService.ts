import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { FIXED_AUTH_NAMES, isFixedAuthName, normalizeAuthName } from '../config/authNames';

export type AuthProfileType = 'fixed' | 'registered' | 'guest';

export interface AuthProfile {
  name: string;
  type: AuthProfileType;
}

interface AccountRow {
  name: string;
  password_hash: string;
  type: Exclude<AuthProfileType, 'guest'>;
}

export class AccountService {
  static getFixedUsers(): string[] {
    return FIXED_AUTH_NAMES;
  }

  static async fixedLogin(name: string, password: string): Promise<{ profile: AuthProfile; isFirstLogin: boolean }> {
    const normalizedName = normalizeAuthName(name);
    if (!isFixedAuthName(normalizedName)) {
      throw new Error('Name is not in fixed list');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must contain at least 4 characters');
    }

    const account = await this.getAccountByName(normalizedName);
    if (!account) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `insert into accounts (name, password_hash, type) values ($1, $2, $3)`,
        [normalizedName, passwordHash, 'fixed']
      );

      return {
        profile: {
          name: normalizedName,
          type: 'fixed'
        },
        isFirstLogin: true
      };
    }

    const isValid = await bcrypt.compare(password, account.password_hash);
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
  }

  static async login(name: string, password: string): Promise<AuthProfile> {
    const normalizedName = normalizeAuthName(name);
    if (!normalizedName) {
      throw new Error('Name is required');
    }
    if (!password) {
      throw new Error('Password is required');
    }

    const account = await this.getAccountByName(normalizedName);
    if (!account) {
      throw new Error('Account not found');
    }

    const isValid = await bcrypt.compare(password, account.password_hash);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    return {
      name: normalizedName,
      type: account.type
    };
  }

  static async register(name: string, password: string): Promise<AuthProfile> {
    const normalizedName = normalizeAuthName(name);
    if (!normalizedName) {
      throw new Error('Name is required');
    }
    if (password.length < 4) {
      throw new Error('Password must contain at least 4 characters');
    }

    const existing = await this.getAccountByName(normalizedName);
    if (existing) {
      throw new Error('Account already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const type: Exclude<AuthProfileType, 'guest'> = isFixedAuthName(normalizedName) ? 'fixed' : 'registered';

    await pool.query(
      `insert into accounts (name, password_hash, type) values ($1, $2, $3)`,
      [normalizedName, passwordHash, type]
    );

    return {
      name: normalizedName,
      type
    };
  }

  static guestLogin(name: string): AuthProfile {
    const normalizedName = normalizeAuthName(name);
    if (!normalizedName) {
      throw new Error('Guest name is required');
    }

    return {
      name: normalizedName,
      type: 'guest'
    };
  }

  private static async getAccountByName(name: string): Promise<AccountRow | null> {
    const { rows } = await pool.query(
      `select name, password_hash, type from accounts where lower(name) = lower($1) limit 1`,
      [name]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as AccountRow;
  }
}
