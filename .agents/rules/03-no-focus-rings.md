# No focus rings

- All application UI uses ring-free focus, including browser, Tauri, Home, Anatomy, popovers, and portals.
- Never add visible focus outlines, outline offsets, focus borders, box-shadow rings, filter rings, or pseudo-element frames for `:focus`, `:focus-visible`, `:focus-within`, or equivalent state classes.
- Show keyboard focus with existing background tokens or text underlining. Keep actual focus, Tab navigation, accessible names, and focus restoration; never use `blur()` to hide focus styling.
- Use the shared focus policy in `apps/web/src/style.css`. Component styles must not reintroduce rings. Ordinary layout borders and model-selection rendering retain their own semantics.
- Verify pointer focus, Tab, and Escape in light and dark themes. Focus restoration must not leave a ring around a button, input, checkbox, or canvas.
