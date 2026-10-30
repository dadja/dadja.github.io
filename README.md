# Ha!! Buggy website

The official one-page site for **Ha!! Buggy** by Reptx Studios, in English and French, with every page the
stores need: privacy policy, terms of use, safety & security, support and data deletion, plus `app-ads.txt`,
`security.txt`, a sitemap and social-media previews. It publishes itself on **GitHub Pages** for free.

## Publish it (about 15 minutes, all in the browser)

1. **Create the repository.** On GitHub, click **New repository** and name it exactly
   **`<your-github-name>.github.io`** (for example `reptxstudios.github.io`). Make it **Public**.
   This name puts the site at the root of the domain, which is required for `app-ads.txt` to be found by AdMob.
2. **Upload the files.** On the new repository page: **Add file → Upload files**, then drag *the contents* of this
   folder (including the hidden `.github` folder: on a Mac press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> to show it).
   Commit to `main`.
3. **Fill in `site.json`.** Click it on GitHub, then the pencil icon:
   | Key | Put |
   |---|---|
   | `site_url` | `https://<your-github-name>.github.io` |
   | `support_email` | your public support address (it is shown on the site and the stores) |
   | `admob_publisher_id` | AdMob → Settings → Account information → Publisher ID (`pub-…`) |
   | `app_store_url` | leave `""` until the iPhone version is live; the button then says "Coming soon" |
   | `custom_domain` | optional, e.g. `habuggy.com` (see below) |
   Commit.
4. **Turn on Pages.** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Open the **Actions** tab: the "Publish website" run turns green in about a minute.
   Your site is live at `https://<your-github-name>.github.io`.

If the run fails, open it: the message lists exactly which value in `site.json` is missing.
Every later edit (texts, settings) republishes the site automatically.

## Links to paste in the stores

| Where | Field | URL |
|---|---|---|
| Google Play → Store settings → Store listing contact details | Website | `https://<name>.github.io/` |
| Google Play → Policy → App content → Privacy policy | Privacy policy | `https://<name>.github.io/privacy.html` |
| Google Play → Policy → App content → Data safety → Data deletion | Delete account URL | `https://<name>.github.io/delete-data.html` |
| App Store Connect → App Privacy | Privacy Policy URL | `https://<name>.github.io/privacy.html` |
| App Store Connect → version page | Support URL | `https://<name>.github.io/support.html` |
| App Store Connect → version page | Marketing URL | `https://<name>.github.io/` |
| App Store Connect → App Information → License Agreement (optional) | Custom EULA | text of `terms.html` |
| AdMob → Apps → App settings → app-ads.txt | Developer website (verify) | `https://<name>.github.io/` (file served at `/app-ads.txt`) |

French versions live under `/fr/` (for example `/fr/privacy.html`) if a store asks for a localized policy.

## Before you go live: make the pages true

These pages describe the game **after** the children's-privacy changes listed in the launch kit
(age screen and child mode, child-safe ad settings, Report button, in-app data deletion).
Ship those changes in the same release, or edit the matching sentences in `legal/privacy.*.html`,
`legal/security.*.html` and the "For parents" list in `content.py`.
`security.*.html` also promises two-step sign-in on your team accounts: turn it on for GitHub, Google Play Console,
App Store Connect, AdMob and your server provider.

## Edit the content

| What | File |
|---|---|
| One-pager texts (EN + FR), FAQ, parents list | `content.py` |
| Privacy, terms, security, support, data deletion | `legal/<page>.en.html` and `legal/<page>.fr.html` |
| Colours, fonts, layout | `assets/css/site.css` |
| Screenshots | `assets/img/*.webp` (1280 × 720) |
| Live gameplay in the hero | `assets/js/levels.js` (real level data) + `site.js` |

Change the `updated` date in `site.json` whenever you change a legal page.

## Preview on your computer

```
python3 build.py --preview
python3 -m http.server -d dist 8000     # open http://localhost:8000
```

## Custom domain (optional)

Buy a domain, set `custom_domain` in `site.json`, then in your DNS add four `A` records to
`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (or a `CNAME` for `www` to
`<name>.github.io`). In **Settings → Pages**, enter the domain and tick **Enforce HTTPS**.
Update the store links afterwards.

## What's inside

```
build.py            static site generator (Python standard library only)
content.py          all one-pager text, English and French
legal/              long pages, one file per page and language
assets/             css, fonts (self-hosted, no Google Fonts tracking), images, js
.github/workflows/  builds and publishes on every push
site.json           your settings
```
Fonts: the two game fonts plus IBM Plex Sans (SIL Open Font License). Nothing is loaded from third-party servers,
so the site sets no cookies and needs no cookie banner.
