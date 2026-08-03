# Git Workflow Instructions

Use these rules when the user asks to commit, push, or open a pull request.

## Commit Rules

- Commit when a change set is complete, validated, and reads like a coherent unit of work.
- Good commit boundaries include finishing a feature section, completing a route or file group, or finishing a safe refactor.
- Do not commit half-finished work unless the user explicitly wants a checkpoint.
- If the user is still moving through the same logical change, suggest waiting until the section is complete before committing.
- Keep commit messages short, specific, and professional.

## Push Rules

- Before pushing, automatically apply the commit rules first.
- Push only after the relevant commit is created or when the user explicitly asks to push.
- A push should contain the exact committed work, with no extra unreviewed changes mixed in.
- If there are uncommitted changes that are not part of the requested push, call that out before pushing.

## Pull Request Rules

- Before opening a pull request, automatically apply the commit rules first and the push rules if the branch needs to be updated.
- When the user asks for a PR, prepare it from the current branch with a professional summary.
- Use the repository's PR template when one exists.
- Include what changed, why it changed, and how it was validated.
- Keep the description concise but complete; avoid vague language.
- Mention any known limitations, follow-ups, or risks if they matter.

## Recommendation Rules

- Recommend a commit when a section is logically finished, a route has been updated end to end, or a fix has been validated.
- Recommend keeping work in progress when the user is still exploring the same flow or likely to make adjacent edits next.
- Recommend pushing when the commit is ready to share or when the user specifically asks for the push step.
- Recommend opening a PR when the branch is ready for review or when the user wants the work packaged for feedback.

## Example Behavior

Good:

```text
This is a clean commit boundary: the task creation validation is complete and the unit test passes.
```

Good:

```text
You are still changing the same sidebar flow, so I would wait to commit until the section is finished.
```

Good:

```text
I can push this commit now because the requested change is complete and there are no unrelated edits.
```

Good:

```text
I can open a PR using the template and summarize the route change, validation, and any follow-up risk.
```

Bad:

```text
Commit everything whenever possible, even if the work is still incomplete.
```

Bad:

```text
Push unrelated edits together with the requested branch update.
```