(function () {
  "use strict";

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var boardId   = script.getAttribute("data-board");
  var baseUrl   = script.getAttribute("data-url") || "https://postitup.app";
  var btnLabel  = script.getAttribute("data-label") || "📌 Leave a note";
  var position  = script.getAttribute("data-position") || "bottom-right"; // bottom-right | bottom-left

  if (!boardId) { console.warn("[PostItUp] data-board attribute is required"); return; }

  var embedUrl = baseUrl + "/embed/" + boardId;

  /* ── Inject styles ── */
  var style = document.createElement("style");
  style.textContent = [
    "#piu-btn{position:fixed;z-index:9998;bottom:24px;cursor:pointer;",
    position === "bottom-left" ? "left:24px;" : "right:24px;",
    "padding:10px 18px;background:#fef9c3;border:2px solid #1c1c1c;",
    "box-shadow:3px 4px 0 rgba(28,28,28,0.18);",
    "font-family:Georgia,serif;font-size:0.95rem;color:#1c1c1c;",
    "transition:transform .15s,box-shadow .15s;",
    "border-radius:0;}",
    "#piu-btn:hover{transform:translateY(-3px) rotate(-1deg);box-shadow:5px 7px 0 rgba(28,28,28,0.2);}",
    "#piu-drawer{position:fixed;z-index:9999;bottom:0;",
    position === "bottom-left" ? "left:0;" : "right:0;",
    "width:420px;max-width:100vw;height:70vh;",
    "transform:translateY(100%);transition:transform .3s cubic-bezier(.22,1,.36,1);",
    "display:flex;flex-direction:column;",
    "border-top:2px solid #1c1c1c;border-left:2px solid #1c1c1c;border-right:2px solid #1c1c1c;",
    "box-shadow:-4px -4px 0 rgba(28,28,28,0.12);}",
    "#piu-drawer.open{transform:translateY(0);}",
    "#piu-drawer-header{height:40px;flex-shrink:0;background:#fef9c3;",
    "border-bottom:1.5px solid rgba(28,28,28,0.15);",
    "display:flex;align-items:center;justify-content:space-between;padding:0 14px;",
    "font-family:Georgia,serif;font-size:0.9rem;color:#1c1c1c;}",
    "#piu-drawer-header button{background:none;border:none;cursor:pointer;",
    "font-size:1.1rem;color:#5a5850;line-height:1;}",
    "#piu-iframe{flex:1;border:none;width:100%;display:block;background:#faf9f6;}",
    "@media(max-width:480px){#piu-drawer{width:100vw;}}"
  ].join("");
  document.head.appendChild(style);

  /* ── Floating button ── */
  var btn = document.createElement("button");
  btn.id = "piu-btn";
  btn.setAttribute("aria-label", btnLabel);
  btn.textContent = btnLabel;
  document.body.appendChild(btn);

  /* ── Drawer ── */
  var drawer = document.createElement("div");
  drawer.id = "piu-drawer";
  drawer.setAttribute("aria-hidden", "true");

  var header = document.createElement("div");
  header.id = "piu-drawer-header";
  var title = document.createElement("span");
  title.textContent = "📌 PostItUp";
  var closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close board");
  header.appendChild(title);
  header.appendChild(closeBtn);

  var iframe = document.createElement("iframe");
  iframe.id = "piu-iframe";
  iframe.setAttribute("allow", "clipboard-write");
  // Don't set src yet — lazy load when opened
  var loaded = false;

  drawer.appendChild(header);
  drawer.appendChild(iframe);
  document.body.appendChild(drawer);

  /* ── Toggle logic ── */
  var open = false;
  function openDrawer() {
    open = true;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    btn.style.display = "none";
    if (!loaded) { iframe.src = embedUrl; loaded = true; }
  }
  function closeDrawer() {
    open = false;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    btn.style.display = "";
  }

  btn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) closeDrawer();
  });
})();
