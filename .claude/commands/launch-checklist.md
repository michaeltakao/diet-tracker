Review this service for launch readiness.

Check all categories:

## Legal
- [ ] Terms of Service exists
- [ ] Privacy Policy exists (required if collecting any user data)
- [ ] Data processing compliant with applicable law (GDPR / APPI / etc.)
- [ ] Third-party licenses reviewed
- [ ] If handling payments: compliance with payment regulations

## Security
- [ ] Authentication implemented (not "we'll add it later")
- [ ] No hardcoded secrets or API keys in code
- [ ] User data encrypted at rest and in transit
- [ ] Input validation on all user inputs
- [ ] Rate limiting on public endpoints
- [ ] Dependencies scanned for known vulnerabilities

## Payments (if applicable)
- [ ] Payment processor integrated and tested
- [ ] Test mode disabled before launch
- [ ] Refund policy defined
- [ ] Invoice / receipt generation

## Analytics
- [ ] Core funnel instrumented (signup → activation → retention)
- [ ] Error tracking enabled (Sentry or equivalent)
- [ ] One North Star Metric defined and tracked

## Monitoring
- [ ] Uptime monitoring enabled
- [ ] Alerting on errors and downtime
- [ ] Logging sufficient to debug user-reported issues

## Support
- [ ] Way for users to contact you
- [ ] Response time expectation set

## Launch
- [ ] Backup/recovery plan exists
- [ ] Rollback plan exists
- [ ] First 10 users identified (not "we'll figure it out")

For each failed check, provide:
- Risk if skipped
- Minimum acceptable fix before launch
