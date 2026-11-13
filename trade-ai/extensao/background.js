// Clicking the icon (or Alt+S) injects the panel into the current tab, or toggles it if it is already there.
// It only runs on the tab you click: the extension does not read any other site.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) {
    console.warn("Sinal Honesto: não deu para abrir nesta página.", e);
  }
});
