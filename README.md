# Muelsyse's Blog

This is [Muelsyse](https://github.com/Muelsyseqwq)'s personal blog for course labs, paper reading notes, and project work.

Website: [https://muelsyseqwq.github.io/](https://muelsyseqwq.github.io/)

## Content

- **CS144:** computer networking labs and implementation notes
- **Paper Reading:** notes on multimodal learning, edge intelligence, and feature compression
- **Other Notes:** development tools, engineering problems, and lessons learned from projects

Posts live in `src/content/posts/`. Add a `series` field to a post's frontmatter to include it in a collection:

```yaml
---
title: CS144-Lab2
author: Muelsyse
pubDatetime: 2026-08-27T20:00:00+08:00
featured: false
draft: true
tags:
  - CS144
series: CS144
description: Notes from CS144 Lab 2.
---
```

## Local Development

Node.js 22.22.3 or newer is required.

```powershell
npm ci
npm run dev
```

The local site is available at `http://localhost:4321/` by default.

Before publishing, run:

```powershell
npm run lint
npm run format:check
npm run build
```

## Publishing

Run the included publishing script from PowerShell:

```powershell
.\publish.ps1 -Message "Update posts"
```

The script fetches remote changes, installs dependencies, checks and builds the site, commits the changes, and pushes them to GitHub. GitHub Actions then deploys the `main` branch to GitHub Pages.

To validate the project without committing or pushing:

```powershell
.\publish.ps1 -DryRun
```

## Tech Stack

- [Astro](https://astro.build/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Pagefind](https://pagefind.app/)
- [KaTeX](https://katex.org/)
- GitHub Pages

## Credits and License

This blog was originally based on [AstroPaper](https://github.com/satnaing/astro-paper). The original project uses the MIT License; its license and copyright notice remain in [LICENSE](LICENSE).
