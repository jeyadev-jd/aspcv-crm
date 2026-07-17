import { Router } from 'express';
import { getMLForecast } from '../controllers/mlAnalyticsController';

const router = Router();

router.get('/ml-forecast', getMLForecast);

export default router;
