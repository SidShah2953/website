# The newsletter email

Every post marked `newsletter: true` becomes a **draft** broadcast in Kit when it
lands on `main` (`.github/workflows/ci.yml` → `scripts/newsletter.mjs`). Nothing
is sent until you press send in Kit.

The draft is built from the post's front matter, so there is nothing to write:

| Email section | Comes from |
|---|---|
| Subject, hero title | `title` |
| Hero subtitle, inbox preview text | `description` |
| "New essay · N min read" | word count, same formula as the page |
| "The short version" | `thesis` (falls back to the first two paragraphs) |
| Video poster, linked to the player | `video` + `public/media/<slug>/email-poster.jpg` |
| Button | the post URL |

## Files

- `render.mjs`: the body HTML that Kit drops into `{{ message_content }}`.
  Tables and inline styles only; see the header comment for why.
- `kit-template.html`: the shell (fonts, dark ground, masthead, footer,
  unsubscribe, postal address, phone breakpoints). Lives in Kit.
- `../../public/email/surface.jpg`: the hero background, a still of the
  homepage shader (`src/components/Surface.astro`) rendered at 1200×640.

## One-time setup in Kit

1. Kit → **Send → Email Templates → New template → HTML**. Paste
   `kit-template.html` and save. Kit checks for the unsubscribe and address
   tags; both are in the footer.
2. Find the template's ID: it is the number in the editor URL, or
   `curl -H "X-Kit-Api-Key: $KIT_API_KEY" https://api.kit.com/v4/email_templates`.
3. GitHub repo → Settings → Secrets and variables → Actions:
   - secret `KIT_API_KEY` (Kit → Settings → Developer → API key, v4)
   - variable `KIT_EMAIL_TEMPLATE_ID` = the number from step 2
4. Make sure the postal address in Kit's account settings is the one you want
   printed in the footer.

## Publishing a post with a video

```sh
node scripts/video-assets.mjs path/to/video.mp4 <slug> --at <poster second>
```

That writes `public/media/<slug>/` (video, poster, email poster, metadata) and
prints the two lines to add: `video:` in front matter, and `<Video>` in the
body. The newsletter refuses to draft if `video` is set but the body has no
`<Video>`, because the email links to `#video` on the page.

## Preview before pushing

```sh
node scripts/newsletter.mjs --preview <slug>          # a post in the repo
node scripts/newsletter.mjs --preview path/to/draft.md # a draft anywhere
open .email-preview/<slug>.html
```

The preview loads images from `public/`, so it is accurate before deploy.
Kit's own "Send test email" is the final check on a real phone.

## Why the video is a poster, not a player

Gmail, Outlook and most Android clients strip `<video>`. Apple Mail plays it,
but a hybrid that shows video there and an image elsewhere depends on CSS hacks
that Kit's pipeline and Gmail's style rewriting both break in different ways.
The poster (play button and running time baked into the image) works
everywhere and lands the reader on the real player, which is `src/components/Video.astro`.
