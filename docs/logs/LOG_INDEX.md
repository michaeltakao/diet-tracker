# Agent Log Index
<!-- Auto-populated by overnight_runner.sh and agent tasks -->
<!-- Format: | Date | Agent | Task | Outcome | Log File | -->

| Date | Agent | Task | Outcome | Log |
|------|-------|------|---------|-----|
<!-- rows added automatically -->

## Log Retention Policy
- Keep last 30 days of logs
- Archive monthly summaries

## Log Location
- Agent task logs: `~/agents/logs/task-YYYYMMDD-HHMMSS.log`
- Overnight runner: `~/agents/logs/overnight-YYYYMMDD.log`
- CI logs: via `gh run view <id> --log`
