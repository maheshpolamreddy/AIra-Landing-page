# AIra Firebase Analytics

Shared GA4 property via measurement ID `G-9FT49STZ0P` (Firebase project `aira-landingpage`).

Landing service: `lib/analytics/index.ts`  
Tutor service: see tutor repo `src/services/analyticsService.ts` (same event names).

## Privacy rules

**Never send:** passwords, tokens, API keys, emails, phone numbers, signed URLs, full lesson scripts, AI prompts/responses, audio data, stack traces.

**Allowed:** IDs, roles, language, teaching style, content_source, durations, HTTP status, error categories.

## Auth events (landing)

- signup_started / sign_up / signup_failed  
- login_started / login / login_failed / logout  
- feature_used: welcome_email_sent, verification_email_sent, waitlist_join  
- api_performance: welcome, send_verification, waitlist  

## User properties

user_role, selected_mode, teaching_style, preferred_language, content_source_last  

## Firebase Console checklist

1. Confirm Analytics enabled for web app with measurement ID `G-9FT49STZ0P`.  
2. Register custom dimensions listed in tutor `docs/ANALYTICS.md`.  
3. Open DebugView; set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` for localhost.  
4. Verify sign_up / login appear within ~1 minute in DebugView.  

## Page performance

`components/analytics-page-reporter.tsx` emits `page_view` + `page_performance` per route.
