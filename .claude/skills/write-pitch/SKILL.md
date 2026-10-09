---
name: write-pitch
description: Write a Shape Up pitch in Notion (Product > Pitches database) for a new feature or integration, with mockups and exact code locations, and process review comments on it. Use when the user asks to write, shape or pitch a feature, to "schrijf een pitch", to process comments on a pitch, or types /write-pitch.
---

# Write a pitch

Pitches live in the Notion database **Pitches** (`collection://73ff00bf-c0a1-49ec-b2d1-1f77958156fe`,
properties `Naam`, `Status`, `Beschikbare tijd`, `Deadline`). We follow Basecamp's Shape Up. Write
the pitch before any code and do not start building until the user approves it.

Stop if you don't have Notion access and ask the user to fix the Notion MCP if needed.

## 1. Prepare

- Read the Notion docs linked from CLAUDE.md that apply (do not guess), and one recent pitch
  (e.g. "Communicatiemodule") for tone and structure. The template is "Nieuwe pitch (template)".
- Explore the codebase first: find the closest existing features and the exact places you would touch (view, action builder, endpoint folder, structure, model).
- Ask the user only for decisions that change the shape. Otherwise choose a default and list it
  under Open vragen.

## 2. Write it (Dutch)

Create the page in the Pitches database with `Status: Analyse` and `Beschikbare tijd` (the
appetite, e.g. "2 weken"). Sections, in order:

- **Probleem**: who suffers, what they do today. Short.
- **Beschikbare tijd**: the appetite is fixed; scope is what flexes.
- **Werking**: numbered flows, each with a mockup and the exact place in code (file, function).
  Cover data (what goes where, and what is deliberately not sent), permissions, privacy, edge
  cases (changes, deletions, duplicates, unsubscribes) and platform level versus organization
  level. Prefer one simple rule per edge case over a mechanism.
- **Technische aanpak**: very short, and only if list essential information for decision making that might change the shape of the feature. Can be skipped. Before publishing, let a subagent review it on maintainability and brevity.
- **Rabbit holes** and **No-gos**: what we deliberately do not solve, with the reason.
- **Open vragen**: decisions and facts to verify on day 1. Mark unverified API facts as
  "te verifiëren" instead of stating them as true.
- **Doelstellingen**: checkboxes that define success.

## 3. Mockups

Make one small HTML wireframe per screen with `notion-create-attachment` (`.html`) and place it
with `<embed src="file-upload://...">`. Grey boxes, the new element in pink, and a pink note naming
the file and function where it is added. Show variants (with/without a setting) in one file.

## 4. Process comments

- Read all comments with `notion-get-comments` (`include_all_blocks: true`) and treat each as a
  decision to apply. Reply in the same thread (`discussion_id`) saying where it was handled.
- Never use `replace_content` on a commented page: it destroys the comment anchors. Use
  `update_content`.

## Notion gotchas

- `update_content` cannot match text across commented spans. Match plain text inside one span, or
  use short anchors on both sides.
- Table `old_str` has no tabs in fetched output but needs none either; a row with a comment cannot
  be edited, so add the content in a paragraph below it.
- Embeds cannot be matched or replaced. Insert the new embed and tell the user which old one to
  delete.
- `~~strike~~` gets escaped in some contexts; avoid it.
- Fetch the page again after bigger edits and check what you changed.
