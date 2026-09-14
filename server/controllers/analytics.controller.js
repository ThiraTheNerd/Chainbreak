import * as analyticsService from '../services/analytics.service.js';

export async function research(_req, res) {
  const result = await analyticsService.getResearchAnalytics();
  res.json(result);
}
