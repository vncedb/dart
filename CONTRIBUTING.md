# Contributing to DART 🎯

First off, thank you for contributing to DART! As a private, production-grade application, maintaining code quality, security, and consistency is our top priority.

The following is a set of guidelines for contributing to DART. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

---

## 🌿 Branching Strategy

We follow a standardized branching model to keep our development environment clean:

* **`main`**: Production-ready code. Commits to this branch should only come from merged Pull Requests.
* **`develop`**: The active development branch. Features and bug fixes are merged here first for testing.
* **`feature/<feature-name>`**: For new features (e.g., `feature/pdf-export`).
* **`bugfix/<bug-name>`**: For bug fixes (e.g., `bugfix/auth-crash-ios`).
* **`hotfix/<issue>`**: For urgent production fixes directly branching from `main`.

---

## 📝 Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) to automatically generate changelogs and maintain a readable history.

**Format:** `type(optional-scope): description`

**Types:**
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation only changes
* `style`: Changes that do not affect the meaning of the code (white-space, formatting)
* `refactor`: A code change that neither fixes a bug nor adds a feature
* `test`: Adding missing tests or correcting existing tests
* `chore`: Changes to the build process or auxiliary tools

**Example:**
`feat(export): add pdf generation support`

---

## 🚀 Pull Request Process

1. Ensure your code follows the established style guidelines (run `npm run lint`).
2. Update the README or technical documentation with details of changes to the interface, new environment variables, or new dependencies.
3. Open a Pull Request against the `develop` branch.
4. Request a review from at least one other team member.
5. Once approved and all CI checks pass, the PR can be squashed and merged.