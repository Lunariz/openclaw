# Obsidian Memory Workflow Skill (Template)

Use this template when your `memory/` folder is an Obsidian vault and you want
graph-aware memory hygiene.

## Goal

- Keep notes queryable via `memory_search` and Obsidian graph tools.
- Prefer explicit relationships via `[[WikiLinks]]`.
- Reduce orphan and dead-end notes.

## Writing rules

- Use descriptive note titles and stable paths.
- Add clear heading structure (`#`, `##`, `###`) so section chunking remains meaningful.
- Keep each section focused on one topic or decision.
- Add outbound links from new notes to at least one related existing note when relevant.

## Retrieval workflow

Before creating or editing notes:

1. Run `memory_search` for semantic recall.
2. Run `obsidian_search` for vault-native lookup.
3. Use `obsidian_backlinks` on target notes before adding new links.
4. Periodically inspect `obsidian_orphans` and `obsidian_dead_ends`.

## Link conventions

- Prefer `[[Canonical Note Title]]` over raw relative links when both are valid.
- For aliases, use `[[Canonical Note Title|Alias Shown In Text]]`.
- Avoid duplicate pages with near-identical titles.

## Hygiene checklist

- New note has at least one inbound or outbound relationship when applicable.
- Heading structure is present for notes larger than a few paragraphs.
- Decision notes include date/context and links to related implementation notes.
