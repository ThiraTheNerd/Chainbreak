// The standard, unmodified System Usability Scale (Brooke, 1996). Item
// count, order, and polarity must not change — the 0-100 scoring formula
// (server/routes/assessment.js) depends on odd items being positively
// worded and even items being negatively worded.

export const SUS_SCALE = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly agree' },
]

export const SUS_ITEMS = [
  { id: 1,  text: 'I think that I would like to use ChainBreak frequently.', positive: true },
  { id: 2,  text: 'I found ChainBreak unnecessarily complex.', positive: false },
  { id: 3,  text: 'I thought ChainBreak was easy to use.', positive: true },
  { id: 4,  text: 'I think that I would need the support of a technical person to be able to use ChainBreak.', positive: false },
  { id: 5,  text: 'I found the various functions in ChainBreak were well integrated.', positive: true },
  { id: 6,  text: 'I thought there was too much inconsistency in ChainBreak.', positive: false },
  { id: 7,  text: 'I would imagine that most people would learn to use ChainBreak very quickly.', positive: true },
  { id: 8,  text: 'I found ChainBreak very cumbersome to use.', positive: false },
  { id: 9,  text: 'I felt very confident using ChainBreak.', positive: true },
  { id: 10, text: 'I needed to learn a lot of things before I could get going with ChainBreak.', positive: false },
]
