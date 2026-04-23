export const XANO_BASE = 'https://x8ki-letl-twmt.n7.xano.io/api:zFS15jK8'

export const ENDPOINTS = {
  signup: '/auth/signup',
  login: '/auth/login',
  me: '/auth/me',
  projectsList: '<PASTE_XANO_PROJECTS_LIST_PATH>',

  // Verify endpoint accepts { code } or { token } depending on your Xano setup.
  verifyEmail: '<PASTE_XANO_VERIFY_EMAIL_PATH>',

  // Resend endpoint accepts { email } or uses auth context depending on your Xano setup.
  resendVerification: '<PASTE_XANO_RESEND_VERIFY_PATH>',
} as const
