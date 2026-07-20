# Checkmark

A fast, keyboard-friendly task manager built with React, Vite, and Tailwind CSS. Organize tasks into tasklists, group related tasklists into color-coded clipboards, and manage everything with drag-and-drop, multi-select, tags, and rich-text titles — all saved locally in your browser.

## Features

- Multiple tasklists, each with its own tasks, tags, and sort/filter settings
- Clipboards — folders for grouping related tasklists, each with a customizable color
- Pin your most-used tasklists and clipboards for quick access in the sidebar
- Rich-text tasklist titles and descriptions (bold, italic, underline, font size, color)
- Drag-and-drop task reordering, including moving multiple selected tasks together
- Multi-select via Ctrl/Cmd-click, Shift-click, or marquee (drag-select)
- Global search (Ctrl/Cmd+K) across every tasklist's tasks and descriptions
- Tags with custom colors, due dates, start dates, and status tracking
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- Dark and light themes
- No account or backend — everything is saved to your browser's local storage

## Getting started

```bash
npm install
npm run dev
```

Then open the local URL printed in the terminal.

## Available scripts

- `npm run dev` — start the development server with hot reload
- `npm run build` — build for production
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

## Tech stack

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/) for icons
- [date-fns](https://date-fns.org/) for date formatting

## Notes

Checkmark stores all data in your browser's `localStorage`. Clearing your browser data, or switching browsers or devices, will not carry your tasks over — there's currently no sync or account system.

## License

MIT — see [LICENSE](LICENSE).
