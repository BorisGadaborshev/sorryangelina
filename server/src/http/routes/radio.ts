import { Router } from 'express';
import { getRandomRadioStation } from '../../services/RadioBrowser';

export const radioRouter = Router();

radioRouter.get('/station', async (_req, res) => {
  try {
    const station = await getRandomRadioStation();
    res.json(station);
  } catch (error) {
    console.error('Error fetching Radio-Browser station:', error);
    res.status(502).json({ error: 'Failed to fetch radio station' });
  }
});
