import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Autocomplete,
  Box,
  Chip,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import {
  Card,
  CardTask,
  CardTaskStatus,
  CARD_TASK_STATUSES,
  CARD_TASK_STATUS_LABELS,
  DEFAULT_CARD_TASK_STATUS,
  normalizeCardTask
} from '../types';
import { RetroStore } from '../store/RetroStore';
import { formatSprintRef, parseSprintRef, sprintOptions } from '../utils/sprintPicker';

const STATUS_COLORS: Record<CardTaskStatus, { bg: string; fg: string; darkBg: string; darkFg: string }> = {
  analysis: { bg: 'rgba(92, 107, 192, 0.16)', fg: '#3949ab', darkBg: 'rgba(121, 134, 203, 0.22)', darkFg: '#c5cae9' },
  execution: { bg: 'rgba(124, 77, 255, 0.16)', fg: '#5e35b1', darkBg: 'rgba(179, 157, 219, 0.22)', darkFg: '#e1bee7' },
  testing: { bg: 'rgba(0, 151, 167, 0.16)', fg: '#00838f', darkBg: 'rgba(77, 208, 225, 0.2)', darkFg: '#b2ebf2' },
  done: { bg: 'rgba(67, 160, 71, 0.16)', fg: '#2e7d32', darkBg: 'rgba(129, 199, 132, 0.22)', darkFg: '#c8e6c9' },
  closed: { bg: 'rgba(120, 144, 156, 0.18)', fg: '#546e7a', darkBg: 'rgba(176, 190, 197, 0.2)', darkFg: '#cfd8dc' }
};

interface Props {
  card: Card;
  store: RetroStore;
}

const emptyTask = (): CardTask => ({ assignees: [], status: DEFAULT_CARD_TASK_STATUS });

const formatDueDate = (value?: string): string => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
};

const formatEffort = (value?: number): string => {
  if (value == null) return '';
  const label = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${label} дн`;
};

const stepEffort = (current: number | undefined, delta: number): number | undefined => {
  const next = Math.round(((current ?? 0) + delta) * 2) / 2;
  if (next <= 0) return undefined;
  return Math.min(100, next);
};

const TaskCardMeta: React.FC<Props> = observer(({ card, store }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const canEdit = Boolean(store.currentUser);
  const [draft, setDraft] = useState<CardTask>(() => card.task ?? emptyTask());
  const [effortEditing, setEffortEditing] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const cardRef = useRef(card);
  const saveTimer = useRef<number | null>(null);

  draftRef.current = draft;
  cardRef.current = card;

  useEffect(() => {
    if (saveTimer.current != null) return;
    setDraft(card.task ?? emptyTask());
  }, [card.id, card.task?.assignees.join('\n'), card.task?.status, card.task?.dueDate, card.task?.sprint, card.task?.effortDays]);

  const persist = (next: CardTask = draftRef.current) => {
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    draftRef.current = next;
    setDraft(next);
    const normalized = normalizeCardTask(next) ?? null;
    const current = store.cards.find((item) => item.id === cardRef.current.id) ?? cardRef.current;
    store.updateCard({ ...current, task: normalized ?? undefined });
    store.socketService?.updateCardTask(cardRef.current.id, normalized);
  };

  useEffect(() => () => {
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      persist();
    }
  }, []);

  const selectMenuProps = {
    onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    PaperProps: { sx: { maxHeight: 320 } }
  };

  const sprintChoices = useMemo(() => sprintOptions(new Date(), draft.sprint), [draft.sprint]);
  const sprintValue = useMemo(() => {
    const parsed = parseSprintRef(draft.sprint);
    return parsed ? formatSprintRef(parsed) : (draft.sprint ?? '');
  }, [draft.sprint]);

  const participantNames = useMemo(() => {
    const names = [
      ...store.users.map((user) => user.name),
      ...(store.selectedTeam?.members.map((member) => member.name) ?? [])
    ]
      .map((name) => name.trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [store.users, store.selectedTeam?.members]);

  const schedulePersist = (next: CardTask) => {
    draftRef.current = next;
    setDraft(next);
    if (!canEdit) return;
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => persist(next), 350);
  };

  const fieldFill = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.78)';
  const fieldLine = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(90, 70, 140, 0.14)';
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(55, 40, 90, 0.5)';

  const surface = {
    mt: 1.1,
    p: 0.85,
    display: 'flex',
    flexDirection: 'column',
    gap: 0.7,
    borderRadius: 2,
    bgcolor: isDark ? 'rgba(8, 10, 18, 0.35)' : 'rgba(255,255,255,0.58)',
    border: '1px solid',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(90, 70, 140, 0.12)',
    boxShadow: isDark ? 'none' : '0 1px 6px rgba(40, 30, 70, 0.06)'
  };

  const rowLabelSx = {
    fontSize: '0.68rem',
    lineHeight: 1,
    color: muted
  };

  const status = draft.status ?? DEFAULT_CARD_TASK_STATUS;
  const statusColor = STATUS_COLORS[status];

  if (!canEdit) {
    const hasMeta = Boolean(
      draft.assignees.length || draft.dueDate || draft.sprint || draft.effortDays != null || draft.status
    );
    if (!hasMeta) return null;
    return (
      <Box sx={surface} onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Chip
            size="small"
            label={CARD_TASK_STATUS_LABELS[status]}
            sx={{
              height: 24,
              fontSize: '0.72rem',
              fontWeight: 700,
              bgcolor: isDark ? statusColor.darkBg : statusColor.bg,
              color: isDark ? statusColor.darkFg : statusColor.fg
            }}
          />
          {draft.effortDays != null && (
            <Typography variant="caption" sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: 0.4, fontWeight: 700 }}>
              <ScheduleRoundedIcon sx={{ fontSize: 14 }} /> {formatEffort(draft.effortDays)}
            </Typography>
          )}
        </Box>
        {draft.assignees.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {draft.assignees.map((name) => (
              <Chip
                key={name}
                size="small"
                icon={<PersonOutlineRoundedIcon sx={{ fontSize: '16px !important' }} />}
                label={name}
                sx={{ height: 24, maxWidth: '100%', fontSize: '0.72rem', bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124, 77, 255, 0.1)' }}
              />
            ))}
          </Box>
        )}
        {(draft.dueDate || draft.sprint) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.1, opacity: 0.86 }}>
            {draft.dueDate && (
              <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                <EventRoundedIcon sx={{ fontSize: 14 }} /> {formatDueDate(draft.dueDate)}
              </Typography>
            )}
            {draft.sprint && (
              <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                <FlagRoundedIcon sx={{ fontSize: 14 }} /> {draft.sprint}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  }

  const effortLabel = draft.effortDays == null
    ? ''
    : (Number.isInteger(draft.effortDays) ? String(draft.effortDays) : draft.effortDays.toFixed(1));

  return (
    <Box
      sx={surface}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => persist(draftRef.current)}
    >
      <Select
          aria-label="Статус"
          value={status}
          onChange={(event) => {
            persist({ ...draftRef.current, status: event.target.value as CardTaskStatus });
          }}
          MenuProps={{
            onMouseDown: (event) => event.stopPropagation(),
            onPointerDown: (event) => event.stopPropagation()
          }}
          renderValue={(value) => CARD_TASK_STATUS_LABELS[value as CardTaskStatus]}
          sx={{
            width: '100%',
            height: 32,
            fontSize: '0.78rem',
            borderRadius: 1.5,
            fontWeight: 700,
            bgcolor: isDark ? statusColor.darkBg : statusColor.bg,
            color: isDark ? statusColor.darkFg : statusColor.fg,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(90, 70, 140, 0.2)'
            },
            '& .MuiSelect-select': { py: 0.55, display: 'flex', alignItems: 'center' },
            '& .MuiSelect-icon': { color: 'inherit' }
          }}
        >
          {CARD_TASK_STATUSES.map((item) => {
            const color = STATUS_COLORS[item];
            return (
              <MenuItem key={item} value={item} sx={{ fontSize: '0.82rem', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isDark ? color.darkFg : color.fg, flexShrink: 0 }} />
                {CARD_TASK_STATUS_LABELS[item]}
              </MenuItem>
            );
          })}
        </Select>
      <Autocomplete
        multiple
        freeSolo
        filterSelectedOptions
        size="small"
        options={participantNames}
        value={draft.assignees}
        onChange={(_, value) => {
          schedulePersist({
            ...draft,
            assignees: value.map((item) => item.trim()).filter(Boolean)
          });
        }}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                {...tagProps}
                key={key}
                size="small"
                label={option}
                title={option}
                sx={{
                  height: 22,
                  maxWidth: '100%',
                  fontSize: '0.72rem',
                  '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' }
                }}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={draft.assignees.length ? '' : 'Исполнитель'}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <PersonOutlineRoundedIcon sx={{ fontSize: 16, opacity: 0.55, ml: 0.25 }} />
                  {params.InputProps.startAdornment}
                </>
              )
            }}
          />
        )}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.78rem',
            borderRadius: 1.5,
            bgcolor: fieldFill,
            py: '2px',
            '& fieldset': { borderColor: fieldLine }
          },
          '& .MuiAutocomplete-input': draft.assignees.length ? {
            flex: '0 0 0px !important',
            width: '0 !important',
            minWidth: '0 !important',
            p: '0 !important'
          } : {
            minWidth: '64px !important'
          },
          '& .MuiOutlinedInput-root.Mui-focused .MuiAutocomplete-input': {
            flex: '1 1 64px !important',
            width: 'auto !important',
            minWidth: '64px !important',
            py: '3px !important'
          }
        }}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '2.7rem minmax(0, 1fr)',
          columnGap: 0.75,
          rowGap: 0.45,
          alignItems: 'center'
        }}
      >
        <Typography sx={rowLabelSx}>Срок</Typography>
        <Box
          component="input"
          aria-label="Срок"
          id={`task-due-${card.id}`}
          type="date"
          value={draft.dueDate ?? ''}
          onClick={(event: React.MouseEvent<HTMLInputElement>) => {
            const input = event.currentTarget;
            if (typeof input.showPicker === 'function') {
              try { input.showPicker(); } catch { /* picker already open */ }
            }
          }}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            schedulePersist({ ...draftRef.current, dueDate: event.target.value || undefined });
          }}
          sx={{
            width: '100%',
            height: 28,
            border: '1px solid',
            borderColor: fieldLine,
            borderRadius: 1.25,
            px: 0.75,
            bgcolor: fieldFill,
            font: 'inherit',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: draft.dueDate ? 'inherit' : muted,
            outline: 'none',
            cursor: 'pointer',
            '&::-webkit-calendar-picker-indicator': { display: 'none' }
          }}
        />
        <Typography sx={rowLabelSx}>Спринт</Typography>
        <Select
          aria-label="Спринт"
          variant="outlined"
          displayEmpty
          value={sprintValue}
          onChange={(event) => {
            schedulePersist({
              ...draftRef.current,
              sprint: event.target.value || undefined
            });
          }}
          MenuProps={selectMenuProps}
          renderValue={(value) => (value ? String(value) : 'Не выбран')}
          sx={{
            height: 28,
            fontSize: '0.8rem',
            fontWeight: sprintValue ? 600 : 500,
            fontVariantNumeric: 'tabular-nums',
            borderRadius: 1.25,
            bgcolor: fieldFill,
            color: sprintValue ? 'inherit' : muted,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: fieldLine },
            '& .MuiSelect-select': { py: 0.4, display: 'flex', alignItems: 'center' },
            '& .MuiSelect-icon': { color: muted }
          }}
        >
          <MenuItem value="">
            <em>Не выбран</em>
          </MenuItem>
          {sprintChoices.map((value) => (
            <MenuItem key={value} value={value} sx={{ fontSize: '0.82rem' }}>
              {value}
            </MenuItem>
          ))}
        </Select>
        <Typography sx={rowLabelSx}>Дни</Typography>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifySelf: 'start',
            height: 28,
            borderRadius: 1.25,
            border: '1px solid',
            borderColor: fieldLine,
            bgcolor: fieldFill,
            overflow: 'hidden'
          }}
        >
          <IconButton
            size="small"
            aria-label="Меньше человекодней"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setEffortEditing(null);
              schedulePersist({ ...draftRef.current, effortDays: stepEffort(draftRef.current.effortDays, -0.5) });
            }}
            sx={{ width: 24, height: 28, borderRadius: 0, color: muted }}
          >
            <RemoveRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Box
            component="input"
            aria-label="Человекодни"
            inputMode="decimal"
            value={effortEditing ?? effortLabel}
            placeholder="0"
            onFocus={() => setEffortEditing(effortLabel)}
            onBlur={() => setEffortEditing(null)}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const display = event.target.value.replace(',', '.');
              if (display !== '' && !/^\d{0,3}(\.\d?)?$/.test(display)) return;
              setEffortEditing(display);
              if (display === '' || display === '.') {
                schedulePersist({ ...draftRef.current, effortDays: undefined });
                return;
              }
              const parsed = Number(display);
              if (!Number.isFinite(parsed)) return;
              schedulePersist({ ...draftRef.current, effortDays: Math.min(100, Math.max(0, parsed)) });
            }}
            sx={{
              width: 28,
              border: 0,
              p: 0,
              bgcolor: 'transparent',
              textAlign: 'center',
              font: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'inherit',
              outline: 'none',
              '&::placeholder': { color: muted, fontWeight: 500 }
            }}
          />
          <IconButton
            size="small"
            aria-label="Больше человекодней"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setEffortEditing(null);
              schedulePersist({ ...draftRef.current, effortDays: stepEffort(draftRef.current.effortDays, 0.5) });
            }}
            sx={{ width: 24, height: 28, borderRadius: 0, color: muted }}
          >
            <AddRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
});

export default TaskCardMeta;
