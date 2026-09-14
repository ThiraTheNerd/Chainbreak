import { Router } from 'express'
import pool from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Answer key — maps questionId to correct answer letter
// Questions 1-10: web security, 11-23: container, 24-33: cloud
const ANSWER_KEY = {
  1:'C', 2:'B', 3:'C', 4:'D', 5:'B', 6:'C', 7:'C', 8:'D', 9:'B', 10:'C',
  11:'B',12:'B',13:'B',14:'B',15:'B',16:'B',17:'B',18:'B',19:'B',20:'B',
  21:'B',22:'B',23:'A',
  24:'B',25:'C',26:'B',27:'B',28:'B',29:'C',30:'B',31:'B',32:'B',33:'B',
}

// Two additional research instruments, carried on the same assessments row
// as the knowledge answers (see server/db/schema.sql). Item sets are fixed
// — see client/src/lib/confidenceItems.js and susItems.js for the canonical
// wording these ids correspond to.
const CONFIDENCE_ITEM_IDS = [1, 2, 3, 4, 5]
const SUS_ITEM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function validateLikertArray(arr, expectedIds) {
  if (!Array.isArray(arr) || arr.length !== expectedIds.length) return false
  const seen = new Set()
  for (const entry of arr) {
    if (!entry || typeof entry.itemId !== 'number' || !expectedIds.includes(entry.itemId)) return false
    if (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 5) return false
    seen.add(entry.itemId)
  }
  return seen.size === expectedIds.length
}

// Standard SUS scoring (Brooke, 1996): odd items are positively worded
// (score = response - 1), even items are negatively worded
// (score = 5 - response); sum of all 10 scores, x 2.5, gives 0-100.
function computeSusScore(sus) {
  let sum = 0
  for (const { itemId, rating } of sus) {
    sum += (itemId % 2 === 1) ? (rating - 1) : (5 - rating)
  }
  return Math.round(sum * 2.5)
}

router.post('/', async (req, res) => {
  const { type, answers, confidence, sus } = req.body || {}

  if (!['pre','post'].includes(type)) {
    return res.status(400).json({ error: 'type must be pre or post' })
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers array is required' })
  }
  if (!validateLikertArray(confidence, CONFIDENCE_ITEM_IDS)) {
    return res.status(400).json({ error: 'confidence must rate all 5 self-efficacy items (1-5 each)' })
  }

  let susScore = null
  if (type === 'post') {
    if (!validateLikertArray(sus, SUS_ITEM_IDS)) {
      return res.status(400).json({ error: 'sus must rate all 10 usability items (1-5 each)' })
    }
    susScore = computeSusScore(sus)
  }

  let web = 0, container = 0, cloud = 0
  for (const { questionId, answer } of answers) {
    const correct = ANSWER_KEY[questionId]
    if (!correct) continue
    const isCorrect = answer === correct
    if (questionId <= 10)  web       += isCorrect ? 1 : 0
    if (questionId <= 23 && questionId > 10) container += isCorrect ? 1 : 0
    if (questionId > 23)   cloud     += isCorrect ? 1 : 0
  }

  // Attempts-log model: NEVER overwrite a prior submission. A pre/post
  // research study cannot risk silently losing a participant's result to a
  // resubmit — every attempt is its own row, numbered per (user_id, type)
  // so the FIRST one (attempt_number = 1) stays identifiable as the
  // canonical attempt for analysis (see GET /mine below).
  const [[{ nextAttempt }]] = await pool.execute(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS nextAttempt
       FROM assessments WHERE user_id = ? AND type = ?`,
    [req.user.id, type]
  )

  await pool.execute(
    `INSERT INTO assessments
       (user_id, type, answers, score_web, score_container, score_cloud, attempt_number,
        confidence_ratings, sus_responses, sus_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id, type, JSON.stringify(answers), web, container, cloud, nextAttempt,
      JSON.stringify(confidence),
      type === 'post' ? JSON.stringify(sus) : null,
      susScore,
    ]
  )

  return res.status(201).json({
    submitted: true,
    type,
    attemptNumber: nextAttempt,
    scores: { web, container, cloud, total: web + container + cloud },
    confidence,
    ...(type === 'post' ? { sus: { responses: sus, score: susScore } } : {}),
    submittedAt: new Date().toISOString(),
  })
})

router.get('/mine', async (req, res) => {
  // Canonical view: the FIRST attempt of each type (attempt_number = 1) is
  // what pre/post analysis should use — never silently substitute the
  // latest. attemptCount surfaces whether a resubmission happened at all,
  // so a researcher can see it rather than have it hidden.
  const [rows] = await pool.execute(
    `SELECT a.type, a.score_web, a.score_container, a.score_cloud,
            a.score_web + a.score_container + a.score_cloud AS total,
            a.confidence_ratings AS confidenceRatings,
            a.sus_score AS susScore,
            a.submitted_at, a.attempt_number AS attemptNumber,
            counts.attempt_count AS attemptCount
       FROM assessments a
       JOIN (
         SELECT user_id, type, COUNT(*) AS attempt_count
           FROM assessments
          WHERE user_id = ?
          GROUP BY user_id, type
       ) counts ON counts.user_id = a.user_id AND counts.type = a.type
      WHERE a.user_id = ? AND a.attempt_number = 1`,
    [req.user.id, req.user.id]
  )
  return res.json({ assessments: rows })
})

export default router
