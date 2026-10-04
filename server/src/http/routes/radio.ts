import { Router } from 'express';
import { logger } from '../../utils/logger';
import { getRandomRadioStation } from '../../services/RadioBrowser';

export const radioRouter = Router();

radioRouter.get('/station', async (_req, res) => {
  try {
    const station = await getRandomRadioStation();
    res.json(station);
  } catch (error) {
    logger.error({ err: error }, 'error fetching Radio-Browser station');
    res.status(502).json({ error: 'Failed to fetch radio station' });
  }
});
