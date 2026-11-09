import { Router } from 'express';
import { logger } from '../../utils/logger';
import { fetchBoardWeather, locateByIp, parseCoordinate } from '../../services/Weather';

export const weatherRouter = Router();

weatherRouter.get('/', async (req, res) => {
  try {
    let lat = parseCoordinate(req.query.lat, -90, 90);
    let lon = parseCoordinate(req.query.lon, -180, 180);

    if (lat === null || lon === null) {
      const located = await locateByIp(req.ip || '');
      if (!located) {
        res.status(204).end();
        return;
      }
      lat = located.lat;
      lon = located.lon;
    }

    const weather = await fetchBoardWeather(lat, lon);
    res.json(weather);
  } catch (error) {
    logger.error({ err: error }, 'error fetching board weather');
    res.status(502).json({ error: 'Failed to fetch weather' });
  }
});
