#!/usr/bin/env python3
"""Builds the Ha!! Buggy website into dist/ (plain static files for GitHub Pages).

    python3 build.py            # real build: fails if site.json still has placeholders
    python3 build.py --preview  # local preview with visible placeholders
    python3 -m http.server -d dist 8000

Only the Python standard library is needed. Edit texts in content.py, settings in site.json.
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path

from content import T, LEGAL

HERE = Path(__file__).resolve().parent
DIST = HERE / "dist"
CFG = json.loads((HERE / "site.json").read_text(encoding="utf-8"))
PREVIEW = "--preview" in sys.argv
e = html.escape

# ---------------------------------------------------------------- settings check
problems = []
if not CFG["support_email"] or "@" not in CFG["support_email"]:
    problems.append('support_email: put your public support address, e.g. "reptxstudios.help@gmail.com"')
if "YOUR-GITHUB-NAME" in CFG["site_url"] and not CFG["custom_domain"]:
    problems.append('site_url: replace YOUR-GITHUB-NAME with your GitHub user name, e.g. "https://reptxstudios.github.io"')
warnings = []
if CFG["admob_publisher_id"] and not re.fullmatch(r"pub-\d{10,20}", CFG["admob_publisher_id"]):
    problems.append('admob_publisher_id: must look like "pub-1234567890123456" (AdMob > Settings > Account information), or stay empty')
if not CFG["admob_publisher_id"]:
    warnings.append("admob_publisher_id is empty, so app-ads.txt is not published yet. Add it before your ads go live.")
if problems and not PREVIEW:
    sys.exit("site.json needs a few values before publishing:\n  - " + "\n  - ".join(problems))
EMAIL = CFG["support_email"] or "[support email]"
SITE = (f"https://{CFG['custom_domain']}" if CFG["custom_domain"] else CFG["site_url"]).rstrip("/")
PLAY = CFG["google_play_url"]
IOS = CFG["app_store_url"]
CO = CFG["company"]
PAGES = ["index", "privacy", "terms", "security", "support", "delete-data"]


def url(lang, page):
    """Absolute URL of a page (canonical, sitemap, Open Graph)."""
    base = SITE + ("/fr/" if lang == "fr" else "/")
    return base if page == "index" else base + page + ".html"


def href(lang, page, here_lang):
    """Relative link from a page in here_lang to page in lang."""
    up = "../" if here_lang == "fr" else ""
    path = ("fr/" if lang == "fr" else "") + ("" if page == "index" else page + ".html")
    return (up + path) or "./"


def fill(s):
    return (s.replace("{EMAIL}", f'<a class="mail" href="mailto:{e(EMAIL)}">{e(EMAIL)}</a>')
             .replace("{EMAIL_TEXT}", e(EMAIL)).replace("{CO}", e(CO)).replace("{PLACE}", e(CFG["city_country"])))


ICON_DL = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-5-5m5 5l5-5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>'


def stores(t):
    play = (f'<a class="store" href="{e(PLAY)}" rel="noopener">{ICON_DL}<span><small>{t["dl_on"]}</small><b>Google Play</b></span></a>')
    if IOS:
        ios = f'<a class="store" href="{e(IOS)}" rel="noopener">{ICON_DL}<span><small>{t["dl_on"]}</small><b>App Store</b></span></a>'
    else:
        ios = f'<span class="store soon" aria-disabled="true">{ICON_DL}<span><small>{t["soon"]}</small><b>App Store</b></span></span>'
    return f'<div class="stores">{play}{ios}</div>'


# ---------------------------------------------------------------- layout
def layout(lang, page, title, desc, main, extra_head=""):
    t = T[lang]
    r = "../" if lang == "fr" else ""
    other = "en" if lang == "fr" else "fr"
    nav_home = href(lang, "index", lang)
    links = "".join(f'<a href="{nav_home}#{a}">{t["nav"][a]}</a>' for a in ["play", "worlds", "parents", "faq"])
    get = f'<a class="btn-get" href="{nav_home}#get">{t["get"]}</a>'
    foot_game = f'''<li><a href="{e(PLAY)}" rel="noopener">Google Play</a></li>
<li>{f'<a href="{e(IOS)}" rel="noopener">App Store</a>' if IOS else f'<span style="color:var(--muted)">App Store · {t["soon_short"]}</span>'}</li>
<li><a href="{href(lang, "support", lang)}">{t["pages"]["support"]}</a></li>'''
    foot_legal = "".join(f'<li><a href="{href(lang, p, lang)}">{t["pages"][p]}</a></li>' for p in ["privacy", "terms", "security", "delete-data"])
    alternates = "".join(f'<link rel="alternate" hreflang="{l}" href="{url(l, page)}">' for l in ["en", "fr"]) + f'<link rel="alternate" hreflang="x-default" href="{url("en", page)}">'
    return f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#050a1e">
<link rel="canonical" href="{url(lang, page)}">
{alternates}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ha!! Buggy">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url(lang, page)}">
<meta property="og:image" content="{SITE}/assets/img/og.jpg">
<meta property="og:locale" content="{'fr_FR' if lang == 'fr' else 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{r}assets/img/favicon.ico" sizes="32x32">
<link rel="icon" href="{r}assets/img/icon-64.png" type="image/png">
<link rel="apple-touch-icon" href="{r}assets/img/apple-touch-icon.png">
<link rel="preload" href="{r}assets/fonts/dodger.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{r}assets/css/site.css">
{extra_head}
</head>
<body>
<a class="skip" href="#main">{t["skip"]}</a>
<header class="top"><div class="inner">
<a class="brand" href="{nav_home}"><img src="{r}assets/img/icon-64.png" alt="" width="34" height="34"><span>HA!! BUGGY</span></a>
<nav aria-label="{t["nav_label"]}"><span class="navlinks">{links}</span>
<a class="lang" href="{href(other, page, lang)}" hreflang="{other}" lang="{other}">{T[lang]["lang_name"]}</a>{get}</nav>
</div></header>
<main id="main">
{main}
</main>
<footer class="site"><div class="inner">
<div class="about"><a class="brand" href="{nav_home}"><img src="{r}assets/img/icon-64.png" alt="" width="34" height="34"><span>HA!! BUGGY</span></a><p>{fill(t["foot_about"])}</p></div>
<div><h4>{t["foot_game"]}</h4><ul>{foot_game}</ul></div>
<div><h4>{t["foot_legal"]}</h4><ul>{foot_legal}</ul></div>
<div><h4>{t["foot_contact"]}</h4><ul><li><a href="mailto:{e(EMAIL)}">{e(EMAIL)}</a></li><li><a href="{href(other, page, lang)}" hreflang="{other}">{T[lang]["lang_name_long"]}</a></li></ul></div>
<div class="legalese"><span>© 2026 {e(CO)} · {e(CFG["city_country"])}</span><span>{t["trademarks"]}</span></div>
</div></footer>
</body>
</html>
'''


# ---------------------------------------------------------------- one-pager
def index(lang):
    t = T[lang]
    h = t["home"]
    r = "../" if lang == "fr" else ""
    rules = "".join(f'<article class="rule"><canvas data-art="{a}" width="76" height="76" aria-hidden="true"></canvas><div><h3>{e(x)}</h3><p>{e(y)}</p></div></article>'
                    for a, (x, y) in zip(["chip", "glitch", "exit"], h["rules"]))
    worlds = "".join(f'''<article class="world" style="--wc:{c}"><img src="{r}assets/img/{img}.webp" alt="{e(alt)}" loading="lazy" width="1280" height="720">
<div><span class="num">{t["world"]} {i + 1}</span><h3>{e(name)}</h3><p>{e(text)}</p></div></article>'''
                     for i, (c, img, name, text, alt) in enumerate(h["worlds"]))
    cast = "".join(f'<div class="person" style="--pc:{c}"><canvas data-art="{a}" width="72" height="72" aria-hidden="true"></canvas><div><b>{e(n)}</b><p>{e(d)}</p><q>{e(q)}</q></div></div>'
                   for a, c, n, d, q in h["cast"])
    feats = "".join(f'<article class="feature"><span class="ic">{e(k)}</span><h3>{e(x)}</h3><p>{e(y)}</p></article>' for k, x, y in h["features"])
    checks = "".join(f"<li><span>{fill(x)}</span></li>" for x in h["parents"])
    faq = "".join(f"<details><summary>{e(q)}</summary><div>{fill(a).replace('{SUPPORT}', href(lang, 'support', lang)).replace('{DELETE}', href(lang, 'delete-data', lang))}</div></details>" for q, a in h["faq"])
    facts = "".join(f"<li>{e(f)}</li>" for f in h["facts"])
    ld = json.dumps({
        "@context": "https://schema.org", "@type": "MobileApplication", "name": "Ha!! Buggy",
        "operatingSystem": "Android, iOS", "applicationCategory": "GameApplication", "inLanguage": "en",
        "description": h["lede"], "image": f"{SITE}/assets/img/og.jpg", "url": url(lang, "index"),
        "author": {"@type": "Organization", "name": CO}, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
    }, ensure_ascii=False)
    names = json.dumps({"prefix": h["live_prefix"]}, ensure_ascii=False)
    main = f'''
<section class="hero" id="get"><div class="inner">
<div>
<div class="eyebrow">{e(h["eyebrow"])}</div>
<h1>{h["h1"]}</h1>
<p class="lede">{e(h["lede"])}</p>
{stores(t)}
<ul class="facts">{facts}</ul>
</div>
<figure class="screen"><canvas id="live" width="1280" height="720" role="img" aria-label="{e(h["live_alt"])}" data-names='{e(names)}'></canvas>
<figcaption><span id="live-label"></span> · {e(h["live_caption"])}</figcaption></figure>
</div></section>

<section class="band alt" id="play"><div class="inner">
<div class="sec-head"><span class="eyebrow">{e(h["play_eyebrow"])}</span><h2>{e(h["play_h2"])}</h2><p>{e(h["play_p"])}</p></div>
<div class="rules">{rules}</div>
</div></section>

<section class="band" id="worlds"><div class="inner">
<div class="sec-head"><span class="eyebrow">{e(h["worlds_eyebrow"])}</span><h2>{e(h["worlds_h2"])}</h2><p>{e(h["worlds_p"])}</p></div>
<div class="worlds">{worlds}</div>
</div></section>

<section class="band alt" id="story"><div class="inner cast">
<div><div class="sec-head" style="margin-bottom:24px"><span class="eyebrow">{e(h["story_eyebrow"])}</span><h2>{e(h["story_h2"])}</h2><p>{e(h["story_p"])}</p></div>
<div class="people">{cast}</div></div>
<figure class="screen" style="margin:0"><img src="{r}assets/img/story.webp" alt="{e(h["story_alt"])}" loading="lazy" width="1280" height="720"></figure>
</div></section>

<section class="band" id="features"><div class="inner">
<div class="sec-head"><span class="eyebrow">{e(h["feat_eyebrow"])}</span><h2>{e(h["feat_h2"])}</h2></div>
<div class="features">{feats}</div>
</div></section>

<section class="band" id="parents" style="padding-top:0"><div class="inner">
<div class="parents"><div class="intro"><span class="eyebrow">{e(h["par_eyebrow"])}</span><h2 style="margin-top:8px">{e(h["par_h2"])}</h2><p>{e(h["par_p"])}</p>
<div class="pill-links"><a href="{href(lang, "privacy", lang)}">{t["pages"]["privacy"]}</a><a href="{href(lang, "security", lang)}">{t["pages"]["security"]}</a><a href="{href(lang, "delete-data", lang)}">{t["pages"]["delete-data"]}</a></div></div>
<ul class="checks">{checks}</ul></div>
</div></section>

<section class="band alt" id="faq"><div class="inner">
<div class="sec-head"><span class="eyebrow">FAQ</span><h2>{e(h["faq_h2"])}</h2></div>
<div class="faq">{faq}</div>
</div></section>

<section class="cta"><div class="inner">
<h2>{e(h["cta_h2"])}</h2><p>{e(h["cta_p"])}</p>
{stores(t)}
</div></section>
'''
    head = f'<script type="application/ld+json">{ld}</script>'
    scripts = f'<script src="{r}assets/js/levels.js" defer></script><script src="{r}assets/js/art.js" defer></script><script src="{r}assets/js/store.js" defer></script><script src="{r}assets/js/site.js" defer></script>'
    return layout(lang, "index", h["title"], h["desc"], main, head + scripts)


# ---------------------------------------------------------------- document pages
def doc(lang, page):
    t = T[lang]
    body = fill(LEGAL[page][lang]).replace("{DELETE}", href(lang, "delete-data", lang)).replace("{PRIVACY}", href(lang, "privacy", lang)) \
        .replace("{SUPPORT}", href(lang, "support", lang)).replace("{TERMS}", href(lang, "terms", lang)).replace("{SECURITY}", href(lang, "security", lang)).replace("{ROOT}", "../" if lang == "fr" else "")
    # ids for h2 + contents list
    toc = []

    def add_id(m):
        text = re.sub("<[^>]+>", "", m.group(1))
        slug = re.sub(r"[^a-z0-9]+", "-", text.lower().encode("ascii", "ignore").decode()).strip("-") or f"s{len(toc) + 1}"
        toc.append((slug, text))
        return f'<h2 id="{slug}">{m.group(1)}</h2>'
    body = re.sub(r"<h2>(.*?)</h2>", add_id, body)
    toc_html = "".join(f'<li><a href="#{s}">{e(x)}</a></li>' for s, x in toc)
    meta = t["doc_meta"].format(date=CFG["updated"], app="Ha!! Buggy", co=CO)
    main = f'''
<section class="doc-hero"><div class="inner"><span class="eyebrow">Ha!! Buggy · {e(CO)}</span><h1>{e(t["pages"][page])}</h1><p>{e(meta)}</p></div></section>
<div class="inner doc">
<nav class="toc" aria-label="{t["on_page"]}"><b>{t["on_page"]}</b><ol>{toc_html}</ol></nav>
<article class="prose">{body}</article>
</div>'''
    return layout(lang, page, f'{t["pages"][page]} · Ha!! Buggy', t["desc_pages"][page], main)


def notfound(lang):
    t = T[lang]
    main = f'<section class="notfound"><div class="inner"><h1>404</h1><p>{e(t["nf"])}</p><a class="store" href="/">{ICON_DL}<span><small>Ha!! Buggy</small><b>{e(t["nf_btn"])}</b></span></a></div></section>'
    return layout(lang, "index", "404 · Ha!! Buggy", t["nf"], main)


# ---------------------------------------------------------------- write
shutil.rmtree(DIST, ignore_errors=True)
shutil.copytree(HERE / "assets", DIST / "assets")
for lang in ["en", "fr"]:
    out = DIST / ("fr" if lang == "fr" else "")
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(index(lang), encoding="utf-8")
    for p in PAGES[1:]:
        (out / f"{p}.html").write_text(doc(lang, p), encoding="utf-8")
(DIST / "404.html").write_text(notfound("en"), encoding="utf-8")
(DIST / ".nojekyll").write_text("")
if CFG["admob_publisher_id"]:
    (DIST / "app-ads.txt").write_text(f"google.com, {CFG['admob_publisher_id']}, DIRECT, f08c47fec0942fa0\n")
(DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
urls = "".join(f"<url><loc>{url(l, p)}</loc><lastmod>{CFG['updated']}</lastmod></url>" for l in ["en", "fr"] for p in PAGES)
(DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
(DIST / ".well-known").mkdir(exist_ok=True)
(DIST / ".well-known/security.txt").write_text(
    f"Contact: mailto:{EMAIL}\nExpires: 2027-10-25T00:00:00.000Z\nPreferred-Languages: en, fr\nCanonical: {SITE}/.well-known/security.txt\nPolicy: {url('en', 'security')}\n")
if CFG["custom_domain"]:
    (DIST / "CNAME").write_text(CFG["custom_domain"] + "\n")

print(f"Built {len(PAGES) * 2 + 1} pages into dist/ for {SITE}")
for w in warnings:
    print("Note: " + w)
if problems:
    print("PREVIEW ONLY. Still to fill in site.json:\n  - " + "\n  - ".join(problems))
print("\nLinks for the stores:")
for k, p in [("Website / marketing URL", "index"), ("Privacy policy URL", "privacy"), ("Support URL", "support"), ("Delete data / account URL", "delete-data"), ("Terms of use", "terms")]:
    print(f"  {k:28} {url('en', p)}")
if CFG["admob_publisher_id"]:
    print(f"  {'app-ads.txt':28} {SITE}/app-ads.txt")
