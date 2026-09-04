// src/lib/confidenceItems.js
// Fixed 5-item self-efficacy / confidence Likert, administered both pre and
// post with identical wording so the two sets of responses are directly
// comparable. Do not add, remove, or reword items — that breaks the
// pre/post pairing for anyone already assessed.

export const CONFIDENCE_SCALE = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly agree' },
]

export const CONFIDENCE_ITEMS = [
  { id: 1, text: 'I could identify and exploit a SQL injection vulnerability.' },
  { id: 2, text: 'I could identify and exploit a broken access control vulnerability.' },
  { id: 3, text: 'I could escalate privileges inside a container (e.g. via a SUID binary).' },
  { id: 4, text: 'I could pivot between systems using leaked credentials or SSH keys.' },
  { id: 5, text: 'I could identify and exploit a cloud misconfiguration (e.g. leaked cloud credentials).' },
]
