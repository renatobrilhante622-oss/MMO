# CC0 landscapes for Eterna menus

These nine 1280×640 WebP images are original scene renders of the source-authored **Kenney** GLBs and **ambientCG** PBR ground textures already distributed with this repository. They are released under **CC0-1.0**, following the unrestricted CC0 source assets. They contain no generated stand-in character/item meshes, stock watermarks, external fonts or AI-generated images.

`manifest.json` records every source URL, its local SHA256 and author, plus each rendered file's SHA256. The upstream CC0 source catalogues are `public/models/environment/manifest.json` and `public/models/dungeon/manifest.json`; original meshes remain unchanged. Scene placement, lighting, floor UV projection and camera composition are authored specifically for these menu banners.

Run Vite and then `python scripts/render-landscape-art.py` to reproduce the images using the optional Python Playwright/Pillow tools and Chromium. `ETERNA_URL` and `ETERNA_CHROME` override the local server and browser paths. The gameplay bundle only downloads the static WebP images; it does not run this renderer or open additional WebGL contexts for cards.

CC0 details: https://creativecommons.org/publicdomain/zero/1.0/
