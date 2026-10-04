import { useState } from 'react';
import { RetroStore } from '../../store/RetroStore';
import { teamApi } from '../../services/teamApi';
import { AvailableRoom, RetroTemplateId } from '../../types';
import type {
  CreateRoomDialogState,
  DeleteRoomDialogState,
  InviteDialogState,
  PasswordDialogState
} from '../TeamRoomsView';
import { buildRoomInvite } from './roomInvite';
import { useCopyFlag } from '../../hooks/useCopyFlag';

interface Options {
  store: RetroStore;
  availableRooms: AvailableRoom[];
  refreshRooms: () => Promise<void>;
  setIsLoading: (value: boolean) => void;
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function useRoomDialogs({ store, availableRooms, refreshRooms, setIsLoading }: Options) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRoomId, setCreateRoomId] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createTemplate, setCreateTemplate] = useState<RetroTemplateId>('classic');

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteRoomId, setDeleteRoomId] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteRoomId, setInviteRoomId] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const inviteCopied = useCopyFlag();

  const openCreate = () => {
    setCreateRoomId('');
    setCreatePassword('');
    setCreateTemplate('classic');
    store.setError(null);
    setIsCreateOpen(true);
  };

  const openJoin = (roomId: string) => {
    setJoinRoomId(roomId);
    setJoinPassword('');
    setJoinError(null);
    setIsJoinOpen(true);
  };

  const openDelete = (roomId: string) => {
    setDeleteRoomId(roomId);
    setDeleteConfirmText('');
    setIsDeleteOpen(true);
  };

  const openInvite = (roomId: string) => {
    setInviteRoomId(roomId);
    setInvitePassword('');
    inviteCopied.clear();
    setIsInviteOpen(true);
  };

  const createRoom = async () => {
    const profile = store.authProfile;
    const team = store.selectedTeam;
    if (!profile || !team || !createRoomId.trim()) return;

    setIsLoading(true);
    store.setError(null);
    try {
      await store.socketService?.createRoom(
        createRoomId.trim(),
        createPassword.trim() || undefined,
        profile.name,
        profile.token,
        { teamId: team.id, template: createTemplate }
      );
      setIsCreateOpen(false);
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось создать комнату'));
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoomById = async (roomId: string, password: string) => {
    const profile = store.authProfile;
    if (!profile) return;

    setIsLoading(true);
    setJoinError(null);
    store.setError(null);
    try {
      await store.socketService?.joinRoom(roomId, password, profile.name, profile.token);
      setIsJoinOpen(false);
    } catch (error) {
      setJoinError(errorMessage(error, 'Не удалось подключиться к комнате'));
      store.setError(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!joinRoomId.trim()) return;
    const room = availableRooms.find((item) => item.id === joinRoomId);
    if (room?.hasPassword !== false && !joinPassword.trim()) return;
    await joinRoomById(joinRoomId.trim(), joinPassword.trim());
  };

  const clickRoom = async (roomId: string) => {
    const room = availableRooms.find((item) => item.id === roomId);
    if (room?.hasPassword === false) {
      try {
        await joinRoomById(roomId, '');
      } catch (error) {
        store.setError(errorMessage(error, 'Не удалось подключиться к комнате'));
      }
      return;
    }
    openJoin(roomId);
  };

  const deleteRoom = async () => {
    const token = store.authProfile?.token;
    if (!token || !deleteRoomId || deleteConfirmText.trim() !== deleteRoomId) return;

    setIsDeleting(true);
    store.setError(null);
    try {
      await teamApi.deleteRoom(deleteRoomId, token);
      setIsDeleteOpen(false);
      setDeleteRoomId('');
      setDeleteConfirmText('');
      await refreshRooms();
    } catch (error) {
      store.setError(errorMessage(error, 'Не удалось удалить комнату'));
    } finally {
      setIsDeleting(false);
    }
  };

  const inviteRoom = availableRooms.find((room) => room.id === inviteRoomId);
  const invite = buildRoomInvite({
    roomId: inviteRoomId,
    password: invitePassword,
    hasPassword: inviteRoom?.hasPassword
  });

  const copyInvite = async () => {
    if (!invite.message) return;
    try {
      await navigator.clipboard.writeText(invite.message);
      inviteCopied.flash();
    } catch {
      store.setError('Не удалось скопировать приглашение');
    }
  };

  const createDialog: CreateRoomDialogState = {
    open: isCreateOpen,
    roomId: createRoomId,
    password: createPassword,
    template: createTemplate,
    onRoomId: setCreateRoomId,
    onPassword: setCreatePassword,
    onTemplate: setCreateTemplate,
    onClose: () => setIsCreateOpen(false),
    onSubmit: () => { void createRoom(); }
  };

  const joinDialog: PasswordDialogState = {
    open: isJoinOpen,
    roomId: joinRoomId,
    password: joinPassword,
    error: joinError,
    onPassword: setJoinPassword,
    onClearError: () => setJoinError(null),
    onClose: () => setIsJoinOpen(false),
    onSubmit: () => { void joinRoom(); }
  };

  const deleteDialog: DeleteRoomDialogState = {
    open: isDeleteOpen,
    roomId: deleteRoomId,
    confirmText: deleteConfirmText,
    busy: isDeleting,
    onConfirmText: setDeleteConfirmText,
    onClose: () => setIsDeleteOpen(false),
    onSubmit: () => { void deleteRoom(); }
  };

  const inviteDialog: InviteDialogState = {
    open: isInviteOpen,
    roomId: inviteRoomId,
    roomHasPassword: inviteRoom?.hasPassword,
    password: invitePassword,
    message: invite.message,
    telegramLink: invite.telegramLink,
    copied: inviteCopied.value,
    onPassword: setInvitePassword,
    onClearCopied: inviteCopied.clear,
    onClose: () => setIsInviteOpen(false),
    onCopy: () => { void copyInvite(); }
  };

  return {
    openCreate,
    openDelete,
    openInvite,
    clickRoom: (roomId: string) => { void clickRoom(roomId); },
    createDialog,
    joinDialog,
    deleteDialog,
    inviteDialog
  };
}
