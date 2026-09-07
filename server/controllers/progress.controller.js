import * as progressService from '../services/progress.service.js';

export async function me(req, res) {
  const result = await progressService.getMyProgress(req.user.id);
  res.json(result);
}
