import React, { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Card, CardActionArea, CardContent, Grid, TextField, Typography } from '@mui/material';
import { AvailableTeam } from '../types';

interface Props {
  teams: AvailableTeam[];
  currentUserName?: string;
  isLoading: boolean;
  onRefresh: () => void;
  onTeamClick: (team: AvailableTeam) => void;
  onCreateClick?: () => void;
  onLogout?: () => void;
  variant?: 'page' | 'embedded';
}

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

const TeamLobby: React.FC<Props> = ({
  teams,
  currentUserName,
  isLoading,
  onRefresh,
  onTeamClick,
  onCreateClick,
  onLogout,
  variant = 'page'
}) => {
  const [search, setSearch] = useState('');
  const isEmbedded = variant === 'embedded';

  const visibleTeams = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return teams.filter((team) => !normalizedSearch || team.name.toLowerCase().includes(normalizedSearch));
  }, [teams, search]);

  const tileHeight = isEmbedded ? 128 : 150;
  const gridItemProps = isEmbedded
    ? { xs: 12, sm: 6 }
    : { xs: 12, sm: 6, md: 4, lg: 3 };

  return (
    <Box
      sx={
        isEmbedded
          ? { width: '100%' }
          : {
              minHeight: '100vh',
              width: '100%',
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              p: { xs: 2, md: 3 }
            }
      }
    >
      {!isEmbedded && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: 1.5,
            mb: 2
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              Выбор команды
            </Typography>
            {currentUserName && (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                Вы вошли как: <b>{currentUserName}</b>
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: { sm: 'wrap' },
              gap: 1,
              flexShrink: 0
            }}
          >
            <Button variant="outlined" onClick={onRefresh} disabled={isLoading}>
              Обновить
            </Button>
            {onLogout && <Button onClick={onLogout}>Выйти</Button>}
          </Box>
        </Box>
      )}

      {isEmbedded && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Выберите команду и введите пароль
        </Typography>
      )}

      <TextField
        size="small"
        label="Поиск команды"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 2, maxWidth: isEmbedded ? '100%' : 520 }}
      />

      <Grid container spacing={isEmbedded ? 1.5 : 2}>
        {visibleTeams.map((team) => (
          <Grid item {...gridItemProps} key={team.id}>
            <Card variant="outlined" sx={{ height: tileHeight }}>
              <CardActionArea onClick={() => onTeamClick(team)} sx={{ height: '100%' }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="subtitle1">{team.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Участников: {team.membersCount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Создана: {formatDate(team.createdAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Владелец: {team.owner}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {onCreateClick && (
          <Grid item {...gridItemProps}>
            <Card variant="outlined" sx={{ height: tileHeight }}>
              <CardActionArea onClick={onCreateClick} sx={{ height: '100%' }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <AddIcon color="primary" fontSize="large" />
                  <Typography variant="subtitle1" color="primary">
                    Создать команду
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default TeamLobby;
