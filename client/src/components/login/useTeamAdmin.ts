import { useState } from 'react';
import { RetroStore } from '../../store/RetroStore';
import { teamApi } from '../../services/teamApi';
import type {
  ChangeTeamPasswordDialogState,
  RemoveMemberDialogState,
  ResetPasswordDialogState
} from '../TeamRoomsView';
import { useCopyFlag } from '../../hooks/useCopyFlag';

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function useTeamAdmin(store: RetroStore) {
  const [busyMemberName, setBusyMemberName] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState('');
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [resetMember, setResetMember] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResetOpen, setIsResetOpen] = useState(false);
  const resetCopied = useCopyFlag();
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [changeValue, setChangeValue] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const team = store.selectedTeam;
  const token = store.authProfile?.token;
  const currentUserName = store.authProfile?.name || '';
  const isTeamAdmin = Boolean(
    team &&
    currentUserName &&
    (team.owner === currentUserName ||
      team.members.some((member) => member.name === currentUserName && member.role === 'admin'))
  );

  const openRemove = (name: string) => {
    setMemberToRemove(name);
    setIsRemoveOpen(true);
  };

  const removeMember = async () => {
    if (!token || !team || !memberToRemove) return;
    setBusyMemberName(memberToRemove);
    store.setError(null);
    try {
      store.setSelectedTeam(await teamApi.removeMember(team.id, token, memberToRemove));
      setIsRemoveOpen(false);
      setMemberToRemove('');
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось удалить участника'));
    } finally {
      setBusyMemberName(null);
    }
  };

  const resetMemberPassword = async (name: string) => {
    if (!token || !team) return;
    setBusyMemberName(name);
    store.setError(null);
    try {
      const data = await teamApi.resetMemberPassword(team.id, token, name);
      if (!data.password) throw new Error('Не удалось сбросить пароль');
      if (data.team) store.setSelectedTeam(data.team);
      setResetMember(name);
      setResetPassword(data.password);
      resetCopied.clear();
      setIsResetOpen(true);
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось сбросить пароль'));
    } finally {
      setBusyMemberName(null);
    }
  };

  const changeTeamPassword = async () => {
    if (!token || !team || !changeValue.trim()) return;
    setIsChanging(true);
    setChangeError(null);
    store.setError(null);
    try {
      store.setSelectedTeam(await teamApi.changeTeamPassword(team.id, token, changeValue.trim()));
      setIsChangeOpen(false);
      setChangeValue('');
    } catch (error) {
      setChangeError(errorMessage(error, 'Не удалось сменить пароль команды'));
    } finally {
      setIsChanging(false);
    }
  };

  const copyResetPassword = async () => {
    if (!resetPassword) return;
    try {
      await navigator.clipboard.writeText(resetPassword);
      resetCopied.flash();
    } catch {
      store.setError('Не удалось скопировать пароль');
    }
  };

  const openChangePassword = () => {
    setChangeValue('');
    setChangeError(null);
    setIsChangeOpen(true);
  };

  const removeDialog: RemoveMemberDialogState = {
    open: isRemoveOpen,
    name: memberToRemove,
    busyName: busyMemberName,
    onClose: () => {
      setIsRemoveOpen(false);
      setMemberToRemove('');
    },
    onSubmit: () => { void removeMember(); }
  };

  const resetDialog: ResetPasswordDialogState = {
    open: isResetOpen,
    name: resetMember,
    password: resetPassword,
    copied: resetCopied.value,
    onClose: () => setIsResetOpen(false),
    onCopy: () => { void copyResetPassword(); }
  };

  const changePasswordDialog: ChangeTeamPasswordDialogState = {
    open: isChangeOpen,
    value: changeValue,
    error: changeError,
    busy: isChanging,
    onValue: setChangeValue,
    onClearError: () => setChangeError(null),
    onClose: () => {
      setIsChangeOpen(false);
      setChangeError(null);
    },
    onSubmit: () => { void changeTeamPassword(); }
  };

  return {
    currentUserName,
    isTeamAdmin,
    openRemove,
    resetMemberPassword: (name: string) => { void resetMemberPassword(name); },
    openChangePassword,
    removeDialog,
    resetDialog,
    changePasswordDialog
  };
}
