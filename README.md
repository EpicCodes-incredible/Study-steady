# Study Steady

A small, installable study planner for choosing daily priorities, focusing in short sessions, and making room for breaks.

## Features

- Add assignments with course, due date, and time estimate.
- Pick up to three priorities for today.
- Use a 25-minute focus timer or a five-minute break timer.
- Mark tasks complete and review the day.
- Carry unfinished priorities to tomorrow.
- Save data in the browser on the student's device.
- Cache the app shell for opening the app offline after the first visit.
- Publish automatically to GitHub Pages after pushing to `main`.

## Run it on your computer

Open a terminal in this folder and run:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Keep the terminal window open while using the local preview.

## Publish it with GitHub Pages (browser-only)

1. Create a **public** repository on GitHub, for example `study-steady`.
2. Unzip the app package on your computer.
3. In the new GitHub repository, choose **Add file → Upload files**. Drag the visible files from the unzipped folder into the upload area, then commit them to `main`. The visible files include `index.html`, `styles.css`, `app.js`, the manifest, service worker, and icons. This browser-only setup does not need the hidden `.github` folder.
4. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then select branch `main` and folder `/(root)`. Save.
5. GitHub will publish the site. Its link will appear in **Settings → Pages** and look like `https://YOUR-USERNAME.github.io/study-steady/`.
6. Open the link on a phone. Use the browser's **Add to Home Screen** or **Install** option.

New commits to `main` republish the site automatically. If you prefer GitHub Desktop and the included `.github/workflows/pages.yml`, choose **GitHub Actions** as the Pages source instead; that workflow also publishes on each push to `main`.

## Data and privacy

Assignments and daily plans are stored in the browser's local storage on that device. This starter version has no account system or cloud sync. The app source is public in a public repository; do not add real student data or private keys to the repository.
