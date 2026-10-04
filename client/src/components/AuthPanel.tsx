import React from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { AvailableTeam, BUILTIN_TEAM_ID } from '../types';
import TeamLobby from './TeamLobby';

interface AuthPanelProps {
  authTab: number;
  loginStep: 'teams' | 'credentials';
  isLoading: boolean;
  isTeamsLoading: boolean;
  availableTeams: AvailableTeam[];
  selectedTeam: AvailableTeam | null;
  loginNames: string[];
  loginName: string;
  loginPassword: string;
  registerName: string;
  registerPassword: string;
  onAuthTab: (tab: number) => void;
  onClearError: () => void;
  onRefreshTeams: () => void;
  onTeamClick: (team: AvailableTeam) => void;
  onBackToTeams: () => void;
  onLoginName: (value: string) => void;
  onLoginPassword: (value: string) => void;
  onLogin: () => void;
  onRegisterName: (value: string) => void;
  onRegisterPassword: (value: string) => void;
  onRegister: () => void;
}

const AuthPanel: React.FC<AuthPanelProps> = ({
  authTab,
  loginStep,
  isLoading,
  isTeamsLoading,
  availableTeams,
  selectedTeam,
  loginNames,
  loginName,
  loginPassword,
  registerName,
  registerPassword,
  onAuthTab,
  onClearError,
  onRefreshTeams,
  onTeamClick,
  onBackToTeams,
  onLoginName,
  onLoginPassword,
  onLogin,
  onRegisterName,
  onRegisterPassword,
  onRegister
}) => (
  <>
    <Tabs
      value={authTab}
      onChange={(_, value) => {
        onAuthTab(value);
        onClearError();
      }}
      variant="fullWidth"
      sx={{ mb: 2 }}
    >
      <Tab label="Вход" />
      <Tab label="Регистрация" />
    </Tabs>

    {authTab === 0 && loginStep === 'teams' && (
      <TeamLobby
        teams={availableTeams}
        isLoading={isTeamsLoading}
        onRefresh={onRefreshTeams}
        onTeamClick={onTeamClick}
        variant="embedded"
      />
    )}

    {authTab === 0 && loginStep === 'credentials' && (
      <>
        <Button size="small" onClick={onBackToTeams} sx={{ mb: 1 }}>
          К командам
        </Button>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          {selectedTeam?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Выберите ФИО и введите пароль
        </Typography>
        {loginNames.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            В команде пока нет участников. Зарегистрируйтесь и войдите в команду после создания учетки.
          </Alert>
        ) : (
          <>
            <TextField
              fullWidth
              select
              label="ФИО"
              margin="normal"
              value={loginName}
              onChange={(event) => onLoginName(event.target.value)}
              disabled={isLoading}
            >
              {loginNames.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              type="password"
              label={selectedTeam?.id === BUILTIN_TEAM_ID ? 'Пароль (при первом входе будет создан)' : 'Пароль'}
              margin="normal"
              value={loginPassword}
              onChange={(event) => onLoginPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onLogin();
                }
              }}
              disabled={isLoading}
            />
            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              onClick={onLogin}
              disabled={isLoading || !loginName || !loginPassword}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Войти'}
            </Button>
          </>
        )}
      </>
    )}

    {authTab === 1 && (
      <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          После регистрации вы сможете выбрать комнату или создать свою.
        </Typography>
        <TextField
          fullWidth
          label="Имя"
          margin="normal"
          value={registerName}
          onChange={(event) => onRegisterName(event.target.value)}
          disabled={isLoading}
        />
        <TextField
          fullWidth
          type="password"
          label="Пароль"
          margin="normal"
          value={registerPassword}
          onChange={(event) => onRegisterPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onRegister();
            }
          }}
          disabled={isLoading}
        />
        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          onClick={onRegister}
          disabled={isLoading || !registerName || !registerPassword}
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Создать учетку'}
        </Button>
      </>
    )}
  </>
);

export default AuthPanel;
