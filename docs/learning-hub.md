# Internal Learning Hub

The Learning Hub is a separate internal knowledge library at `/learning`.

## Access

- `internal` users can read published articles.
- `admin` and `superadmin` users can read drafts and manage all articles.
- All other roles are blocked by both API middleware and client route guards.

## Libraries

### Companies

Use for company products, business models, engineering culture, public ML use cases, interview-loop context, and sourced research. Company articles can store a canonical company name.

### Geography

Use for cities, states or regions, countries, timezones, technology ecosystems, travel considerations, and sourced community context. Geography articles can store city, region, and country code.

### Machine Learning

Use for ML foundations, modeling, experimentation, production systems, responsible AI, leadership, and Staff+ interview preparation. ML articles can be labeled Foundation, Intermediate, Advanced, or Staff+.

## Publishing workflow

1. An admin selects **New article**.
2. Choose a library and provide a title and concise summary.
3. Add category-specific metadata, tags, source URLs, and Markdown content. Use **Insert image** to place a hosted HTTP(S) image at the current editor cursor; provide descriptive alt text for accessibility.
4. Optionally paste exported Excalidraw scene JSON, Mermaid source, or both. These render read-only in a conditional **Diagram** tab.
5. Save as a draft for review or publish for internal users.
6. Optionally feature high-priority material.

## Data model

Articles are stored in `learning_articles` with:

- category, title, summary, and Markdown content;
- optional Excalidraw scene JSON and Mermaid source;
- tags and source links;
- category-specific company, geography, or ML fields;
- featured, draft/published, author, and timestamp metadata.

The table and missing diagram columns are created by the existing `ensureWebModels()` startup synchronization.

## Diagram behavior

- Articles without diagram data keep the existing article-only view.
- Articles with Excalidraw JSON or Mermaid source show an **Article / Diagram** tab bar.
- Excalidraw runs in view mode with editing, links, and embeds disabled.
- Mermaid renders as SVG with strict security enabled; invalid scripts show an inline error instead of breaking the article.
- Both renderers provide zoom, fit/reset, directional pan, and pointer/touch navigation controls without enabling editing.
- Zoom-in has no application-level percentage limit; zoom-out retains a usability floor.
- The article page is bound to the application viewport: the global header owns Back and Edit actions, article content scrolls inside its pane, and the diagram fills all remaining height without scrolling the page.
- Article Markdown headings generate a sticky section navigator with active-section highlighting and shareable hash links; navigation scrolls only the internal article pane.
- Markdown images are responsive, lazy-loaded, and constrained to the article pane. The editor validates image URLs and inserts accessible Markdown image syntax at the current selection.
- Articles with both diagram formats show a compact format switcher so only one full-height canvas is visible at a time.
- Diagram renderers are lazy-loaded, so they do not increase the initial bundle for articles without diagrams.

## API

```text
GET    /api/learning/articles
GET    /api/learning/articles/:id
POST   /api/learning/articles
PATCH  /api/learning/articles/:id
DELETE /api/learning/articles/:id
```

Read endpoints require Learning Hub access. Write endpoints require an admin or superadmin role.
