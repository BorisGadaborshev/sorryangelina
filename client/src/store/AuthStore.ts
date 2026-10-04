import { makeAutoObservable } from 'mobx';
import { AuthProfile, Team } from '../types';

export class AuthStore {
  profile: AuthProfile | null = null;
  selectedTeam: Team | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    this.tryRestoreAuth();
    this.tryRestoreSelectedTeam();
  }

  private saveAuth(profile: AuthProfile) {
    localStorage.setItem('authProfile', JSON.stringify(profile));
  }

  private tryRestoreAuth() {
    const raw = localStorage.getItem('authProfile');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as AuthProfile;
      if (parsed?.name && parsed?.type && parsed?.token && parsed?.expiresAt) {
        if (parsed.expiresAt <= Date.now()) {
          localStorage.removeItem('authProfile');
          return;
        }
        this.profile = parsed;
      }
    } catch {
      localStorage.removeItem('authProfile');
    }
  }

  private tryRestoreSelectedTeam() {
    const raw = localStorage.getItem('selectedTeam');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Team;
      if (parsed?.id && parsed?.name) {
        this.selectedTeam = parsed;
      }
    } catch {
      localStorage.removeItem('selectedTeam');
    }
  }

  setProfile(profile: AuthProfile | null) {
    this.profile = profile;
    if (profile) {
      this.saveAuth(profile);
    } else {
      localStorage.removeItem('authProfile');
    }
  }

  setSelectedTeam(team: Team | null) {
    this.selectedTeam = team;
    if (team) {
      localStorage.setItem('selectedTeam', JSON.stringify(team));
    } else {
      localStorage.removeItem('selectedTeam');
    }
  }

  clear() {
    this.setProfile(null);
    this.setSelectedTeam(null);
  }
}
