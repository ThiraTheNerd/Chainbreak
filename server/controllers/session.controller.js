// controllers/session.controller.js
import * as sessionService from '../services/session.service.js';

export async function startChallenge(req, res) {
  const view = await sessionService.startChallenge(req.user, Number(req.params.id));
  res.status(201).json(view);
}
export async function stopChallenge(req, res) {
  const result = await sessionService.stopChallenge(req.user, req.params.id);
  res.status(200).json(result);
}