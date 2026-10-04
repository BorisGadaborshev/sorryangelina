import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { RetroStore } from '../../store/RetroStore';
import { Card, COLUMN_COLOR_IDS, COLUMN_COLOR_PRESETS, ColumnColorId, buildColumnMarkdown } from '../../types';
import { useCopyFlag } from '../../hooks/useCopyFlag';

interface Props {
  store: RetroStore;
  columnIndex: number;
  cards: Card[];
  accent: string;
}

const ColumnHeader: React.FC<Props> = observer(({ store, columnIndex, cards, accent }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [titleAtEditStart, setTitleAtEditStart] = useState('');
  const [headerMenuAnchorEl, setHeaderMenuAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [colorMenuAnchorEl, setColorMenuAnchorEl] = useState<HTMLElement | null>(null);
  const copied = useCopyFlag();

  const displayTitle = store.getColumnTitle(columnIndex);
  const isStoredColumn = columnIndex < store.templateConfig.columns.length;
  const canEditTitle = store.canEditColumnTitles() && isStoredColumn;
  const columnColorId = store.getColumnColor(columnIndex);
  const roadmapColumns = store.templateConfig.roadmapColumns;
  const resultColumnIndex = roadmapColumns
    ? store.templateConfig.columns.length + roadmapColumns.length - 1
    : -1;
  const canCopyMarkdown = columnIndex === store.templateConfig.actionColumnIndex || columnIndex === resultColumnIndex;

  const startEditingTitle = () => {
    if (!canEditTitle) return;
    setTitleAtEditStart(displayTitle);
    setDraftTitle(displayTitle);
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === displayTitle) return;
    const next = [...store.columnTitles];
    next[columnIndex] = trimmed;
    store.requestColumnTitlesUpdate(next);
  };

  const resetTitleEdit = () => {
    const originalTitle = titleAtEditStart || store.templateConfig.columns[columnIndex]?.title || displayTitle;
    setDraftTitle(originalTitle);
    setIsEditingTitle(false);
  };

  const applyColumnColor = (colorId: ColumnColorId) => {
    setColorMenuAnchorEl(null);
    setHeaderMenuAnchorEl(null);
    if (colorId === columnColorId) return;
    const next = [...store.columnColors];
    next[columnIndex] = colorId;
    store.requestColumnColorsUpdate(next);
  };

  const closeHeaderMenus = () => {
    setHeaderMenuAnchorEl(null);
    setColorMenuAnchorEl(null);
  };

  const copyColumnMarkdown = async () => {
    const markdown = buildColumnMarkdown(cards.filter((card) => !store.isCardTextHidden(card)));
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      copied.flash();
    } catch {
      copied.clear();
    }
  };

  const copyLabel = copied.value ? 'Скопировано' : 'Копировать в Markdown';

  return (
    <Box
      onDoubleClick={startEditingTitle}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        mb: 0.5,
        minHeight: 40,
        px: 0.5
      }}
    >
      {isEditingTitle ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: 1, maxWidth: 360 }}>
          <TextField
            size="small"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                resetTitleEdit();
              }
            }}
            autoFocus
            fullWidth
            inputProps={{ maxLength: 80 }}
          />
          <Tooltip title="Сохранить">
            <IconButton
              size="small"
              color="primary"
              onMouseDown={(event) => event.preventDefault()}
              onClick={commitTitle}
            >
              <CheckIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Вернуть исходное название">
            <IconButton
              size="small"
              onMouseDown={(event) => event.preventDefault()}
              onClick={resetTitleEdit}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <>
          <Typography variant="h6" align="center" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.2 }}>
            {displayTitle}
          </Typography>
          {canCopyMarkdown && (
            <Tooltip title={copyLabel}>
              <span>
                <IconButton
                  size="small"
                  aria-label="Копировать колонку в Markdown"
                  disabled={cards.length === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyColumnMarkdown();
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                  sx={{ opacity: 0.85 }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {canEditTitle && (
            <>
              <IconButton
                size="small"
                aria-label="Действия с колонкой"
                onClick={(event) => {
                  event.stopPropagation();
                  setHeaderMenuAnchorEl(event.currentTarget);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                sx={{ opacity: 0.85 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={headerMenuAnchorEl}
                open={Boolean(headerMenuAnchorEl)}
                onClose={() => setHeaderMenuAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {canCopyMarkdown && (
                  <MenuItem
                    disabled={cards.length === 0}
                    onClick={() => {
                      closeHeaderMenus();
                      void copyColumnMarkdown();
                    }}
                  >
                    <ListItemIcon>
                      <ContentCopyIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{copyLabel}</ListItemText>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    closeHeaderMenus();
                    startEditingTitle();
                  }}
                >
                  <ListItemIcon>
                    <EditIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Изменить название</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setColorMenuAnchorEl(headerMenuAnchorEl);
                    setHeaderMenuAnchorEl(null);
                  }}
                >
                  <ListItemIcon>
                    <FormatColorFillIcon fontSize="small" sx={{ color: accent }} />
                  </ListItemIcon>
                  <ListItemText>Цвет колонки</ListItemText>
                </MenuItem>
              </Menu>
              <Menu
                anchorEl={colorMenuAnchorEl}
                open={Boolean(colorMenuAnchorEl)}
                onClose={() => setColorMenuAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {COLUMN_COLOR_IDS.map((colorId) => {
                  const preset = COLUMN_COLOR_PRESETS[colorId];
                  const isSelected = colorId === columnColorId;
                  return (
                    <MenuItem
                      key={colorId}
                      selected={isSelected}
                      onClick={() => applyColumnColor(colorId)}
                      sx={{ gap: 1.25, minWidth: 196 }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          flexShrink: 0
                        }}
                      >
                        <Box sx={{ flex: 1, display: 'flex' }}>
                          <Box sx={{ flex: 1, bgcolor: colorId === 'none' ? 'background.paper' : preset.light.bg }} />
                          <Box sx={{ flex: 1, bgcolor: colorId === 'none' ? '#1e1e1e' : preset.dark.bg }} />
                        </Box>
                        <Box sx={{ height: 4, display: 'flex' }}>
                          <Box sx={{ flex: 1, bgcolor: preset.light.accent }} />
                          <Box sx={{ flex: 1, bgcolor: preset.dark.accent }} />
                        </Box>
                      </Box>
                      {preset.label}
                    </MenuItem>
                  );
                })}
              </Menu>
            </>
          )}
        </>
      )}
    </Box>
  );
});

export default ColumnHeader;
