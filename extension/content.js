if (!window.screenTaskInitialized) {
  window.screenTaskInitialized = true;

  let overlay, selection, startX, startY, isSelecting = false;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.4);
      z-index: 999999; cursor: crosshair;
    `;

    selection = document.createElement("div");
    selection.style.cssText = `
      position: fixed;
      border: 2px solid #2563eb;
      background: rgba(37,99,235,0.1);
      z-index: 9999999;
    `;

    overlay.appendChild(selection);
    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") removeOverlay();
    });
  }

  function onMouseDown(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
  }

  function onMouseMove(e) {
    if (!isSelecting) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selection.style.left = x + "px";
    selection.style.top = y + "px";
    selection.style.width = w + "px";
    selection.style.height = h + "px";
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;
    const rect = {
      x: parseInt(selection.style.left),
      y: parseInt(selection.style.top),
      width: parseInt(selection.style.width),
      height: parseInt(selection.style.height),
    };
    removeOverlay();
    if (rect.width > 10 && rect.height > 10) {
      chrome.runtime.sendMessage({ action: "regionSelected", rect });
    }
  }

  function removeOverlay() {
    if (overlay) overlay.remove();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "startSelection") createOverlay();
  });
}