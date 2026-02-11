import React, { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Card, CardActionArea, CardContent, Chip, Grid, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import { AvailableRoom } from '../types';

interface Props {
  rooms: AvailableRoom[];
  currentUserName: string;
  onRoomClick: (roomId: string) => void;
  onCreateClick: () => void;
  onDeleteClick: (roomId: string) => void;
}

const phaseLabel: Record<string, string> = {
  creation: 'Создание',
  voting: 'Голосование',
  discussion: 'Обсуждение'
};

const tileSx = {
  height: 150
};

const formatDate = (value?: string): string => {
  if (!value) return 'Дата неизвестна';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата неизвестна';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const RoomTiles: React.FC<Props> = ({ rooms, currentUserName, onRoomClick, onCreateClick, onDeleteClick }) => {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'creation' | 'voting' | 'discussion'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const visibleRooms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...rooms]
      .filter((room) => {
        if (phaseFilter !== 'all' && room.phase !== phaseFilter) return false;
        if (normalizedSearch && !room.id.toLowerCase().includes(normalizedSearch)) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
      });
  }, [rooms, search, phaseFilter, sortOrder]);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Доступные комнаты и создание
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
        <TextField
          size="small"
          label="Поиск по ID комнаты"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TextField
          size="small"
          select
          label="Фаза"
          value={phaseFilter}
          onChange={(event) => setPhaseFilter(event.target.value as 'all' | 'creation' | 'voting' | 'discussion')}
        >
          <MenuItem value="all">Все</MenuItem>
          <MenuItem value="creation">Создание</MenuItem>
          <MenuItem value="voting">Голосование</MenuItem>
          <MenuItem value="discussion">Обсуждение</MenuItem>
        </TextField>
        <TextField
          size="small"
          select
          label="Сортировка"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}
        >
          <MenuItem value="newest">Сначала новые</MenuItem>
          <MenuItem value="oldest">Сначала старые</MenuItem>
        </TextField>
      </Box>
      <Grid container spacing={2}>
        {visibleRooms.map((room) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={room.id}>
            <Card variant="outlined" sx={{ ...tileSx, position: 'relative' }}>
              {room.owner === currentUserName && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteClick(room.id);
                  }}
                  sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, bgcolor: 'rgba(255,255,255,0.85)' }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
              <CardActionArea onClick={() => onRoomClick(room.id)} sx={{ height: '100%' }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1">{room.id}</Typography>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Создана: {formatDate(room.createdAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Участников: {room.usersCount}
                    </Typography>
                    <Chip size="small" label={phaseLabel[room.phase] || room.phase} />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Card variant="outlined" sx={tileSx}>
            <CardActionArea onClick={onCreateClick} sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <AddIcon color="primary" fontSize="large" />
                <Typography variant="subtitle1" color="primary">
                  Создать комнату
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default RoomTiles;
