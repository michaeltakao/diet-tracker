Set up GitHub for this project.

Create or review the following:

## Repository Setup
- README.md with: what it is, how to install, how to run
- .gitignore appropriate for the stack
- LICENSE (MIT for open source, or private)

## Branch Strategy
- `main` — production / stable
- `develop` — active development
- feature branches: `feat/feature-name`

## GitHub Actions CI
Create `.github/workflows/ci.yml` with:
- Linting (ruff for Python)
- Tests (pytest)
- Trigger on push to main/develop and on PRs

## Issues Setup
Create initial issues for:
1. MVP scope definition
2. First feature to implement
3. Known risks or unknowns

## GitHub Actions template for Python projects:

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: ruff check .
      - run: pytest -v
```

Provide:
1. Recommended repository structure
2. CI configuration for this specific project
3. Initial issue list (3-5 issues to start)
