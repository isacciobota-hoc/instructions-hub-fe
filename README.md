# Instructions Hub Frontend

Next.js 14 (App Router) frontend for browsing projects and editing `instructions.md`.

## Requirements

- Node.js 18.17+ (Node 20 recommended)
- Backend API running at `http://localhost:4000`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Features

- Home page fetches projects from `GET http://localhost:4000/projects`
- Click a project to open `/projects/[id]`
- Project page shows name, owner, and updated time
- Edit `instructions.md` in a textarea
- Save using `PUT http://localhost:4000/projects/:id/instructions` with body:

```json
{ "instructions": "..." }
```

- Read-only markdown preview
- Loading and error states on fetch/save
