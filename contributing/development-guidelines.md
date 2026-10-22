# Development do’s and don’ts

#### ✅ Ask questions early and often

> External contributors can ask questions in Slack (invitation only) or via email at support@stamhoofd.be

Don’t spend too much time trying to debug something or trying to find something that you don’t understand. Just ask someone, put it in Slack, you’ll save time for yourself and the whole team. Often by just explaining a problem, you’ll find the solution.

We don’t have a lot of documentation on everything, so often it is good to ask for some recommendations before starting on something.

#### ✅ Use clear commit messages

We have a handful of simple standards for commit messages which help us to generate readable changelogs. Please follow this wherever possible and mention the associated issue number.

```text
1st line: Max 80 character summary written in past tense
2nd line: [Always blank]
3rd line: ref #STA-ID, fixes #STA-ID, closes #STA-ID or blank
4th line: Why this change was made - the code includes the what, the commit message should describe the context of why - why this, why now, why not something else?

```

If your change is user-facing please prepend the first line of your commit with an emoji key. If the commit is for an alpha feature, no emoji is needed. We are following gitmoji.

Main emojis we are using:

```text
✨ Feature
🎨 Improvement / change
🐛 Bug Fix
💡 Anything else flagged to users or whoever is writing release notes
```

#### 🚫 Don’t create merge commits, use rebase.

This is a thing we do, it works better. It might be personal preference, but we can’t combine multiple ways of working.

Learn how to solve conflicts when using rebase.

#### 🚫 Never refactor everything at once. Refactor in small pieces, separate from feature/bug fixing work.

Did you find some old code that you have to touch? Refactor it first in a separate commit. Don’t combine refactoring and feature work in a single commit. This makes it hard to review, and it hides the actual changes in your commit.

#### ✅ Write a tech spec when working on complex features

Put things on paper, in Notion, somewhere. It often helps you end up with a lot cleaner code, and better, reusable patterns. It helps avoid spaghetti code.

#### ✅ Split up your commits, the smaller the better.

It is tempting to commit your whole feature or change in one go. Don’t do this. Commit small working pieces. Iterate in separate commits.

#### ✅ Use feature flags - don’t create long running branches

Don’t create a long running branch where you work on some big feature. Instead, create a feature flag, and commit your working code to the main branch behind a feature flag. This avoids merge conflicts, and still allows you to do small refactorings without making your PR’s impossible to review.

#### ✅ Write tests when you fix a bug

Before you start fixing a bug, it is a good practice to write a failing test. Then you fix the actual bug and your test should succeed. We can keep the test in now, so we are confident that the bug will never return.

#### ✅ Write tests

Try to test your work as much as possible. This avoids large bugs in the future.
- Prefer to add at least one end-to-end test for the happy-path of the feature you are building. Also add a failure path.
- Write tests for critical paths or complex features that can easily be broken by other people that don’t have all the context. By having a test, we know when something is broken, you can add the right context in the test.
- Write unit tests for more complex classes, mostly for library type of classes and building blocks.
- Test permissions.

#### ✅ Try to use git in cli - certainly for fixing merge conflicts

This is a personal thing and not a requirement, but it is a lot easier to understand the ins and outs of git when you use it on the cli. With UI applications (which I also used in the past) you miss out on a lot of context.
