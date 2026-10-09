(function () {
  var ACTIVE = false;
  var overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483647;" +
      "border:2px solid #6366f1;background:rgba(99,102,241,0.12);" +
      "border-radius:4px;display:none;";
    document.body.appendChild(overlay);
    return overlay;
  }

  function findLocated(el) {
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-wf-loc")) return el;
      el = el.parentElement;
    }
    return null;
  }

  function showOverlay(el) {
    var box = ensureOverlay();
    var r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left + "px";
    box.style.top = r.top + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
  }

  function onMouseOver(e) {
    if (!ACTIVE) return;
    var el = findLocated(e.target);
    if (el) showOverlay(el);
    else hideOverlay();
  }

  function onClick(e) {
    if (!ACTIVE) return;
    var el = findLocated(e.target);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    var loc = el.getAttribute("data-wf-loc") || "";
    var parts = loc.split(":");
    window.parent.postMessage(
      {
        source: "webforge-inspector",
        type: "select",
        file: parts[0] || "",
        line: parseInt(parts[1], 10) || 0,
        column: parseInt(parts[2], 10) || 0,
        componentName: el.tagName.toLowerCase(),
      },
      "*"
    );
    // stay in inspect mode — the host page (Preview.tsx) turns it off
    // explicitly via a toggle-inspect message when the user clicks off
  }

  function setInspecting(on) {
    ACTIVE = !!on;
    document.documentElement.style.cursor = ACTIVE ? "crosshair" : "";
    if (!ACTIVE) hideOverlay();
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.source !== "webforge-host") return;
    if (d.type === "toggle-inspect") setInspecting(d.enabled);
  });

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("click", onClick, true);
})();
