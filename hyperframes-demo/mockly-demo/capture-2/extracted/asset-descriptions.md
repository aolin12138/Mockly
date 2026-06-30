# Asset Descriptions

One line per file. Read this instead of opening every image individually.

To find a specific brand or icon, **grep this file for the brand name in the description text** (e.g. `grep -i 'autodesk' asset-descriptions.md`). The Gemini Vision captions identify what's actually in each file — that's the agent's selector.

The `logo-<hash>.svg` filename prefix is a cheap structural hint (DOM said this SVG was inside a `<header>`, home-link `<a>`, or had an aria-label matching the page brand). It is NOT a content claim — many `logo-*` files are nav icons or decorative shapes. Trust the captions, not the filename prefix.

- svgs/svg-18be11ba.svg — This is a black, minimalist icon of a closed envelope with a rounded rectangular outline.
- svgs/svg-89dcaedc.svg — This icon is a black, four-pointed star shape accompanied by a small plus sign in the upper right and a small circle in the lower left.
- svgs/svg-a815d546.svg — This black, line-art icon features an arrow pointing to the right toward a vertical bracket shape, commonly representing a "log in" or "enter" function.
- svgs/svg-fa000487.svg — This is a black, thick-lined icon of a locked padlock.
