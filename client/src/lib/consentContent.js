
export const CONSENT_VERSION = 'v1.0.0'  // bump this to force all participants to re-consent


export const SUMMARY_TEXT =
  'This is a research study for an MSc dissertation at Leeds Beckett University. ' +
  'You will use the ChainBreak security-training platform and complete two short ' +
  'assessments. Participation is voluntary and you may withdraw at any time. ' +
  'Please read the information below and confirm each point before taking part.'


export const PIS_LINK_URL =
  'https://docs.google.com/document/d/1w96t2Yk5-9szF9IO_zNj_axKdcGH6Xm8/edit?usp=sharing&ouid=113073098685767806463&rtpof=true&sd=true'


export const CONSENT_ITEMS = [
  {
    key: 'readPIS',
    text: 'I have read the Participant Information Sheet and understand the nature and purpose of this evaluation.',
  },
  {
    key: 'askedQuestions',
    text: 'I have had the opportunity to ask questions by contacting the researcher, and any questions have been answered to my satisfaction.',
  },
  {
    key: 'voluntaryParticipation',
    text: 'I understand the purpose of the evaluation and what my involvement entails, and I agree to take part voluntarily.',
  },
  {
    key: 'rightToWithdraw',
    text: 'I understand that my participation is voluntary and that I may withdraw at any time during or after the session, without giving a reason, by contacting the researcher with WITHDRAWAL in the email subject line.',
  },
  {
    key: 'dataForPublication',
    text: 'I understand that information gained during this study may be used to generate statistics and may be included in the dissertation report and any resulting academic publications.',
  },
  {
    key: 'anonymisedConfidential',
    text: 'I understand that my personal details will remain confidential, that all data will be anonymised prior to analysis and publication, and that my name will not appear in any research output.',
  },
  {
    key: 'secureStorageSeparateConsent',
    text: 'I understand that all research data will be stored securely on the university’s institutional secure storage, accessible only to the researcher and dissertation supervisor, that my consent record will be stored separately from anonymised research data, and that all data will be held until the end of the university retention period and then securely destroyed.',
  },
  {
    key: 'audioRecordingDeletion',
    text: 'I understand that any audio recording of my interview will be used solely for transcription and permanently deleted once an accurate transcript has been produced, typically within 48 hours.',
  },
  {
    key: 'dataNotUsedBeyondProject',
    text: 'I understand that data collected will not be used for any purpose beyond this research project unless I explicitly give additional permission.',
  },
]


export const AUDIO_CHOICES = [
  { value: 'consented', label: 'I consent to my interview being audio recorded for transcription purposes.' },
  { value: 'declined',  label: 'I do NOT consent to audio recording; I understand written notes will be taken instead.' },
]
