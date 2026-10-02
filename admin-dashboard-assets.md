# WISAL admin visual assets

Created with the built-in image generation tool, using the supplied dashboard as the master reference. These are dedicated local artwork assets, not the application's icon. Both originals were kept in the generator output directory, and copies were saved under `public/assets`.

## Metallic W

File: `public/assets/wisal-admin-w-metallic.png`

Prompt:

Use case: stylized-concept. Asset type: isolated transparent 3D W emblem for an existing WISAL dashboard. The attached image is the MASTER visual reference; generate ONLY its huge standalone metallic gold and electric blue W from the hero on the left, not the interface. Match the reference's sculpted broad ribbon W silhouette precisely: two curving tapered gold front strokes with bright champagne polished edges, a thick cobalt electric-blue ribbon looping behind and at the lower right, deep bevels, realistic metal reflections. Upright three-quarter frontal view, NOT a flat typographic W and NOT a square app icon. Place it standing on the same short dark navy circular plinth with gold top rim. Surround it with elliptical gold and blue glowing light trails and a few tiny sparks, predominantly horizontal. Transparent background with actual alpha, no backdrop, no text, no panels, no UI. W occupies 72% of frame height and trails fill the remaining edges. Match the reference colors, shape, camera and lighting as closely as possible. High detail photorealistic premium 3D render, 1536x1024 landscape asset. This is a project asset, save the output locally.

The resulting artwork is blended into the page with a CSS mask; no square frame is rendered.

## Office backdrop

File: `public/assets/wisal-admin-hero-office.png`

Prompt:

Use case: precise-object-edit. Asset type: background-only hero banner for the WISAL admin page. Attached dashboard is the exact MASTER REFERENCE. Extract/reconstruct ONLY the photographic background of the hero strip immediately under the top bar, no dashboard cards, no sidebar, no topbar. Dark navy blurred modern night office with desk, subtle blue bokeh and amber light, a dark angled premium laptop on the far RIGHT showing a small metallic gold W and WISAL on its back, and green indoor plant in purple ceramic pot at extreme right. Remove the giant W object on the left and remove all overlaid Arabic welcome text and giant WISAL in the center: they will be implemented as separate HTML/image elements. Keep the left and center as dark navy blurred office/desk negative space, do not replace with bright light. Match reference exact lighting, angle, background shapes and colors #07111f. Wide landscape banner about 3:1, 1536x512. No extra objects, no borders, no interface, no floating numbers. Output just the clean photographic backdrop asset.

## Verification scope

`admin-dashboard-final-1920.png` is a real Chrome render of the actual overview/sidebar components and extracted topbar markup. The isolated visual harness fetched real public services, categories, and visit counts from the project's Supabase client. It does not bypass AdminRoute or fetch private admin data. The screenshot is a component preview, not proof of an authenticated admin login. The guard and PIN regression suites were run separately. Runtime harnesses and diagnostic output are stored outside Vite's watched source tree.
