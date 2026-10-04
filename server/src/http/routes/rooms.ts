import { Router } from 'express';
import { BUILTIN_TEAM_ID, TeamService } from '../../services/TeamService';
import { AccountService } from '../../services/AccountService';
import { RoomService } from '../../services/RoomService';
import { clearRoomRuntimeState } from '../../realtime/runtime';
import { readAuth, requireAuth } from '../authMiddleware';

export const roomsRouter = Router();

roomsRouter.get('/', async (_req, res) => {
  try {
    await TeamService.ensureBuiltinTeam();
    const rooms = await RoomService.getAvailableRoomSummaries(BUILTIN_TEAM_ID);
    res.json(rooms);
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

roomsRouter.delete('/:roomId', requireAuth, async (req, res) => {
  const roomId = req.params.roomId;
  const auth = readAuth(res);

  try {
    const room = await RoomService.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.owner !== auth.name) {
      res.status(403).json({ error: 'Only room creator can delete the room' });
      return;
    }
    if (auth.type === 'guest' && await AccountService.hasAccount(room.owner)) {
      res.status(403).json({ error: 'Это имя занято, войдите с паролем' });
      return;
    }

    await RoomService.deleteRoom(roomId);
    clearRoomRuntimeState(roomId, false);
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room via API:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});
