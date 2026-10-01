/** Map Firebase Auth error codes to human-readable copy. */

export function getAuthErrorCode(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    return (err as { code: string }).code
  }
  return ''
}

export function mapAuthError(err: unknown, providerKey?: string): string {
  const code = getAuthErrorCode(err)
  const providerLabel =
    providerKey === 'apple'
      ? 'Apple'
      : providerKey === 'microsoft'
        ? 'Microsoft'
        : providerKey === 'google'
          ? 'Google'
          : providerKey === 'phone'
            ? 'Phone'
            : null

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password. Please try again.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/invalid-phone-number':
      return 'Enter a valid mobile number with country code (e.g. +91…).'
    case 'auth/missing-phone-number':
      return 'Enter your mobile number to continue.'
    case 'auth/invalid-verification-code':
    case 'auth/code-expired':
      return 'That verification code is invalid or expired. Request a new code.'
    case 'auth/missing-verification-code':
      return 'Enter the verification code from SMS.'
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'Phone verification (reCAPTCHA) failed. Hard-refresh the page and try Send code again. If it keeps failing, confirm this site is under Authentication → Settings → Authorized domains.'
    case 'auth/billing-not-enabled':
      return 'Real SMS needs the Blaze plan. Upgrade in Firebase Console → Usage and billing, or add this number under Authentication → Sign-in method → Phone → Phone numbers for testing.'
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for today. Try Google or email sign-in, or try again later.'
    case 'auth/admin-restricted-operation':
      return 'Phone sign-in is restricted for this project. Check Firebase Authentication settings and SMS region policy.'
    case 'auth/argument-error':
      return providerKey === 'phone'
        ? 'Phone verification could not start (invalid reCAPTCHA setup). Refresh and try again.'
        : 'Sign-in could not start because of an invalid request. Refresh and try again.'
    case 'auth/invalid-continue-uri':
    case 'auth/unauthorized-continue-uri':
      return 'Email verification could not be sent because this site is not authorized yet. Add the domain in Firebase Authentication → Settings → Authorized domains.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. You can try again anytime.'
    case 'auth/popup-blocked':
      return 'Pop-up was blocked by your browser. Allow pop-ups for this site, then try again.'
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method. Try that method instead.'
    case 'auth/operation-not-allowed':
      if (providerKey === 'phone') {
        return 'Phone SMS is blocked by Firebase project settings. Enable Phone under Authentication → Sign-in method, then open Authentication → Settings → SMS region policy and allow India (IN) — new projects block all regions by default. Real SMS also needs the Blaze plan (or add a test number under Phone → Phone numbers for testing).'
      }
      if (providerKey === 'apple') {
        return 'Apple sign-in is not fully configured yet. In Firebase Console → Authentication → Sign-in method → Apple, enable it and add Services ID, Team ID, Key ID, and private key.'
      }
      if (providerLabel) {
        return `${providerLabel} sign-in is not enabled yet. Turn it on in Firebase Console → Authentication → Sign-in method → ${providerLabel}.`
      }
      return 'This sign-in method is not enabled in Firebase Console. Enable Email/Password or the social provider under Authentication → Sign-in method.'
    case 'auth/unauthorized-domain': {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'this site'
      if (host === '127.0.0.1') {
        return 'Redirecting to localhost for sign-in… If this persists, reload using http://localhost:3000 instead of 127.0.0.1.'
      }
      return `Sign-in is not enabled for "${host}" yet. Run "pnpm auth:sync-domains" once (see README) or add this domain in Firebase Console → Authentication → Settings → Authorized domains.`
    }
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.'
    case 'auth/missing-email':
      return 'Please enter your email address.'
    case 'auth/internal-error':
      if (providerKey === 'phone') {
        return 'Phone sign-in failed. Real SMS needs Blaze billing, or use a test number under Authentication → Sign-in method → Phone → Phone numbers for testing.'
      }
      return 'Sign-in failed due to a configuration issue. Confirm Email/Password or Google is enabled in Firebase Authentication.'
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not set up for this project yet. Enable it in the Firebase Console.'
    default: {
      // Surface useful Firebase messages when code is missing
      if (typeof err === 'object' && err !== null && 'message' in err) {
        const raw = String((err as { message: unknown }).message)
        if (/already been rendered/i.test(raw)) {
          return 'Phone verification needs a fresh start. Tap Send code again (or refresh once).'
        }
        if (/BILLING_NOT_ENABLED|billing-not-enabled/i.test(raw)) {
          return 'Real SMS needs the Blaze plan. Upgrade in Firebase Console → Usage and billing, or add this number under Authentication → Sign-in method → Phone → Phone numbers for testing.'
        }
        if (raw.includes('CONFIGURATION_NOT_FOUND')) {
          return 'Firebase Authentication is not set up for this project yet. Enable it in the Firebase Console.'
        }
        if (raw.includes('unauthorized-domain') || raw.includes('UNAUTHORIZED_DOMAIN')) {
          return 'This domain is not authorized. Add it under Firebase Authentication → Settings → Authorized domains.'
        }
      }
      if (err instanceof Error && err.message && !err.message.startsWith('Firebase:')) {
        if (/already been rendered/i.test(err.message)) {
          return 'Phone verification needs a fresh start. Tap Send code again (or refresh once).'
        }
        return err.message
      }
      console.warn('[auth]', code || 'unknown', err)
      if (code) {
        return `Sign-in failed (${code.replace(/^auth\//, '')}). Check the browser console for details, then try again.`
      }
      return 'Something went wrong signing in. Please try again.'
    }
  }
}
