chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Full page capture
  if (message.action === "captureScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, async (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false });
        return;
      }
      await sendToBackend(dataUrl);
      sendResponse({ success: true });
    });
    return true;
  }

  // Region selected — crop karo
  if (message.action === "regionSelected") {
    const rect = message.rect;

    chrome.tabs.captureVisibleTab(null, { format: "png" }, async (dataUrl) => {
      if (chrome.runtime.lastError) return;

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const canvas = new OffscreenCanvas(rect.width, rect.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

      const croppedBlob = await canvas.convertToBlob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        await sendToBackend(reader.result);
      };
      reader.readAsDataURL(croppedBlob);
    });
  }
});

// Backend ko screenshot bhejna
async function sendToBackend(imageData) {
  try {
    const response = await fetch("http://localhost:3000/process-screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData }),
    });

    const data = await response.json();
    console.log("Backend response:", data);

    chrome.storage.local.set({ tasks: data.tasks });

  } catch (error) {
    console.error("Backend error:", error);
  }
}