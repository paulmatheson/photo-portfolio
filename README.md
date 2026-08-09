# Photography portfolio

Standalone gallery at **https://photos.paulmatheson.net** — separate from the main portfolio (`../portfolio`), similar to the blog.

## Local development

From this directory:

```bash
npm install
npm start
```

Open http://localhost:8888

Copy `.env` from the main portfolio (or set the same variables in Netlify):

```bash
cp ../portfolio/.env .env
```

Required variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_PHOTO_FOLDER` (optional, defaults to `Portfolio`)
- `API_KEY` (Unsplash stats)

## Deploy on Netlify

Create a **new Netlify site** connected to this folder/repo:

| Setting | Value |
|---------|--------|
| Publish directory | `public` |
| Functions directory | `functions` |

No base directory is needed — this is its own project root.

Add the environment variables above, then set the custom domain to `photos.paulmatheson.net`.

The main portfolio redirects `/photography.html` to this site.
