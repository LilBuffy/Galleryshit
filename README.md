# 🖼️ Gallery

A fucking **static media gallery** na ginawa gamit lang ang **HTML, CSS, at Vanilla JavaScript**.

Walang backend. Walang database. Walang build system. Walang kung anong unnecessary bullshit.

Maglagay ka lang ng images, GIFs, videos, at audio sa `media/`, generate ng manifest, tapos boom, gallery na.

**BLYAAAAT. Simple.**

## 🟢 Project Status

**ACTIVE**

Click Me: https://lilbuffy.github.io/Galleryshit/

Personal project ito para sa isang clean at dark themed media gallery.

Walang backend bullshit na kailangan para gumana.

Kung gusto mong mag add ng media, ilagay mo lang sa `media/` at i regenerate ang manifest.

Simple as fuck.

## 🛠️ Tech Stack

* HTML
* CSS
* Vanilla JavaScript
* Node.js, manifest generator lang
* GitHub Actions
* GitHub Pages

## ⚙️ What This Shit Can Do

* Mag display ng images
* Mag display ng GIFs
* Mag play ng videos
* Mag play ng audio
* Fullscreen lightbox viewer
* Keyboard navigation
* Swipe navigation sa mobile
* Filmstrip navigation
* Search files
* Filter by media type
* Sort media
* Favorite files
* Hide files sa sariling browser view
* Mag display ng file details
* Mag display ng dimensions at file size
* Mag display ng video/audio duration
* Thumbnail size settings
* Hover autoplay
* Reduce motion option
* Confirmation settings
* Responsive sa desktop at mobile

Basically, **media folder mo pero may UI na hindi mukhang Windows Explorer noong 2009.**

## 📁 Project Structure

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── media/
│   ├── manifest.json
│   └── README.md
├── scripts/
│   └── generate-manifest.js
└── .github/
    └── workflows/
        └── deploy.yml
```

## 🗂️ Adding Media

Gusto mong mag add ng bagong shit sa gallery?

Easy.

1. Ilagay ang images, GIFs, videos, o audio sa `media/`
2. Run ang manifest generator:

```bash
node scripts/generate-manifest.js
```

3. Refresh ang gallery.

Supported formats:

* **Images:** jpg, jpeg, png, webp, avif, bmp, svg
* **GIFs:** gif
* **Video:** mp4, webm, mov, ogv
* **Audio:** mp3, wav, m4a, flac, ogg

Kung GitHub Pages ang gamit mo, automatic na nire regenerate ng GitHub Actions ang `manifest.json` kapag nag push ka.

**Add files → commit → push → done.**

ПИЗДЕЦ, mas madali pa kaysa mag organize ng actual files.

## 🧪 Running Locally

Huwag basta double click ang `index.html`.

Dahil gumagamit ang gallery ng `media/manifest.json`, maaaring harangin ng browser ang request kapag `file://` ang gamit.

Mag run ka ng local server.

## ❤️ Favorites & Hidden Files

Dahil static website lang ito at walang backend, ang favorites at hidden files ay naka save sa browser gamit ang `localStorage`.

Meaning:

* Hindi sila napupunta sa GitHub
* Hindi sila shared sa ibang visitors
* Hindi nila binabago ang actual files
* Naka save lang sila sa browser mo

Kapag nag hide ka ng file, **hindi ito nade delete**.

Gamitin ang **Settings → Restore all** para ibalik ang mga hidden files.

So no, hindi mo aksidenteng buburahin ang buong fucking media collection mo dahil napindot mo ang hide button.

## ⚠️ Important Notes

Ang `media/manifest.json` ay **generated file**.

Huwag mo itong manually i edit unless alam mo talaga kung ano ginagawa mo nigga.

Kapag nagdagdag o nag delete ka ng media, regenerate mo ang manifest:

```bash
node scripts/generate-manifest.js
```

Sa GitHub Pages deployment, automatic na itong ginagawa ng workflow.

## ☠️ Disclaimer

**Static gallery lang ’to lods.**

Walang accounts.

Walang database.

Walang backend.

Walang server side authentication.

Walang cloud storage.

Walang fucking AI powered blockchain NFT bullshit.

Ang media files ay actual files sa repository at ang browser lang ang nagbabasa sa kanila.

Kung private ang media mo, **huwag mong ilagay sa public GitHub repository.**

Public repo + private files = **пиздец speedrun any%**.

## 📜 License

Do whatever you want with it.

Modify it.

Break it.

Improve it.

Steal the CSS.

Rewrite the JavaScript.

Just don't blame me kapag gumawa ka ng 14,000 line `app.js`.
