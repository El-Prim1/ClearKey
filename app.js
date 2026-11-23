(() => {
  const storageKey = "clearkey.currentDocument";
  const settingsStorageKey = "clearkey.settings";
  const editor = document.querySelector("#writing-input");
  const wordCount = document.querySelector("#word-count");
  const characterCount = document.querySelector("#character-count");
  const documentStatus = document.querySelector("#document-status");
  const copyButton = document.querySelector(".copy-action");
  const clearButton = document.querySelector(".clear-action");
  const settingsForm = document.querySelector("#settings-form");
  const baseUrlInput = document.querySelector("#base-url");
  const modelNameInput = document.querySelector("#model-name");
  const apiKeyInput = document.querySelector("#api-key");
  const toggleApiKeyButton = document.querySelector("#toggle-api-key");
  const testKeyButton = document.querySelector("#test-key");
  const testKeyButtonLabel = testKeyButton.querySelector("span");
  const toast = document.querySelector("#toast");
  let storageErrorLogged = false;
  let settingsSaveErrorLogged = false;
  let toastTimer = 0;

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, type === "error" ? 10000 : 6000);
  }

  function saveSettings() {
    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify({
        baseUrl: baseUrlInput.value,
        modelName: modelNameInput.value,
        apiKey: apiKeyInput.value
      }));
      settingsSaveErrorLogged = false;
      return true;
    } catch (error) {
      if (!settingsSaveErrorLogged) {
        console.error("ClearKey could not save settings in local storage.", error);
        showToast("Settings could not be saved in this browser.", "error");
        settingsSaveErrorLogged = true;
      }
      return false;
    }
  }

  function loadSettings() {
    try {
      const savedSettings = localStorage.getItem(settingsStorageKey);
      if (savedSettings === null) {
        return;
      }

      const settings = JSON.parse(savedSettings);
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new Error("Saved settings have an invalid format.");
      }

      if (typeof settings.baseUrl === "string") {
        baseUrlInput.value = settings.baseUrl;
      }
      if (typeof settings.modelName === "string") {
        modelNameInput.value = settings.modelName;
      }
      if (typeof settings.apiKey === "string") {
        apiKeyInput.value = settings.apiKey;
      }
    } catch (error) {
      console.error("ClearKey could not load settings from local storage.", error);
      showToast("Saved settings could not be loaded. Check this browser's local storage.", "error");
    }
  }

  function getModelsEndpoint() {
    let url;
    try {
      url = new URL(baseUrlInput.value.trim());
    } catch {
      throw new Error("Enter a valid Base URL.");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Base URL must use HTTPS.");
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("Base URL cannot include credentials, query parameters, or a fragment.");
    }

    const isLoopback = url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "::1"
      || url.hostname === "[::1]";
    if (url.protocol === "http:" && !isLoopback) {
      throw new Error("Use HTTPS for remote providers. HTTP is allowed only for localhost.");
    }

    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/models`;
    return url.href;
  }

  function getProviderErrorMessage(responseText) {
    if (!responseText) {
      return "";
    }

    try {
      const payload = JSON.parse(responseText);
      if (payload && payload.error) {
        if (typeof payload.error === "string") {
          return payload.error;
        }
        if (typeof payload.error.message === "string") {
          return payload.error.message;
        }
      }
      if (payload && typeof payload.message === "string") {
        return payload.message;
      }
    } catch {
      // Non-JSON provider errors are shown as plain text below.
    }

    return responseText.replace(/\s+/g, " ").trim().slice(0, 240);
  }

  async function testApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast("Enter an API key before testing the connection.", "error");
      apiKeyInput.focus();
      return;
    }

    let endpoint;
    try {
      endpoint = getModelsEndpoint();
    } catch (error) {
      showToast(error.message, "error");
      baseUrlInput.focus();
      return;
    }

    testKeyButton.disabled = true;
    testKeyButton.classList.add("is-loading");
    testKeyButtonLabel.textContent = "Testing…";

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal
      });

      if (response.ok) {
        showToast("Connected", "success");
        return;
      }

      const providerMessage = getProviderErrorMessage(await response.text());
      if (response.status === 401) {
        showToast(
          providerMessage
            ? `Invalid API key (401): ${providerMessage}`
            : "Invalid API key (401).",
          "error"
        );
        return;
      }
      if (response.status === 404) {
        showToast(
          providerMessage
            ? `Base URL or /models endpoint not found (404): ${providerMessage}`
            : "Base URL or /models endpoint not found (404).",
          "error"
        );
        return;
      }

      showToast(
        providerMessage
          ? `Provider error (${response.status}): ${providerMessage}`
          : `Provider returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
        "error"
      );
    } catch (error) {
      if (error.name === "AbortError") {
        showToast("Connection timed out. Check the Base URL and try again.", "error");
      } else if (error instanceof TypeError) {
        showToast(
          `Network/CORS error: ${error.message || "Could not reach the provider."} Check the URL, connection, and provider CORS settings.`,
          "error"
        );
      } else {
        showToast(`Could not test the API key: ${error.message || "Unexpected error."}`, "error");
      }
    } finally {
      window.clearTimeout(timeout);
      testKeyButton.disabled = false;
      testKeyButton.classList.remove("is-loading");
      testKeyButtonLabel.textContent = "Test Key";
    }
  }

  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings();
    testApiKey();
  });

  [baseUrlInput, modelNameInput, apiKeyInput].forEach((input) => {
    input.addEventListener("input", saveSettings);
  });

  toggleApiKeyButton.addEventListener("click", () => {
    const shouldShowKey = apiKeyInput.type === "password";
    apiKeyInput.type = shouldShowKey ? "text" : "password";
    toggleApiKeyButton.setAttribute("aria-label", shouldShowKey ? "Hide API key" : "Show API key");
    toggleApiKeyButton.setAttribute("aria-pressed", String(shouldShowKey));
    toggleApiKeyButton.querySelector(".eye-icon").hidden = shouldShowKey;
    toggleApiKeyButton.querySelector(".eye-off-icon").hidden = !shouldShowKey;
  });

  loadSettings();

  function getEditorText() {
    return editor.innerText.replace(/\r\n?/g, "\n");
  }

  function setStatus(message) {
    documentStatus.textContent = message;
  }

  function updateCounts() {
    const text = getEditorText();
    const trimmedText = text.trim();
    wordCount.textContent = trimmedText ? String(trimmedText.split(/\s+/u).length) : "0";
    characterCount.textContent = String(Array.from(text).length);
    editor.dataset.empty = String(text.length === 0);
  }

  function reportStorageError(action, error) {
    setStatus("Local save unavailable");
    if (!storageErrorLogged) {
      console.error(`ClearKey could not ${action} the document in local storage.`, error);
      storageErrorLogged = true;
    }
  }

  function saveDocument() {
    try {
      localStorage.setItem(storageKey, getEditorText());
      storageErrorLogged = false;
      setStatus("Saved in this browser");
    } catch (error) {
      reportStorageError("save", error);
    }
  }

  function insertPlainText(text) {
    if (!text) {
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();

    if (
      selection
      && selection.rangeCount > 0
      && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      range.setStart(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
      range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    range.deleteContents();

    const fragment = document.createDocumentFragment();
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let lastInsertedNode = null;

    lines.forEach((line, index) => {
      if (index > 0) {
        lastInsertedNode = document.createElement("br");
        fragment.append(lastInsertedNode);
      }
      if (line) {
        lastInsertedNode = document.createTextNode(line);
        fragment.append(lastInsertedNode);
      }
    });

    if (!lastInsertedNode) {
      updateCounts();
      return;
    }

    range.insertNode(fragment);
    range.setStartAfter(lastInsertedNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function copyWithFallback(text) {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = text;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.top = "-1000px";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    temporaryInput.setSelectionRange(0, temporaryInput.value.length);

    try {
      return document.execCommand("copy");
    } finally {
      temporaryInput.remove();
      editor.focus();
    }
  }

  async function copyDocument() {
    const text = getEditorText();
    if (!text.trim()) {
      setStatus("There is no text to copy");
      return;
    }

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API is unavailable");
      }
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard");
    } catch (clipboardError) {
      try {
        if (copyWithFallback(text)) {
          setStatus("Copied to clipboard");
          return;
        }
      } catch (fallbackError) {
        console.error("ClearKey clipboard fallback failed.", fallbackError);
      }
      setStatus("Copy failed — allow clipboard access");
      console.error("ClearKey could not copy the document to the clipboard.", clipboardError);
    }
  }

  editor.addEventListener("input", () => {
    updateCounts();
    setStatus("Unsaved changes");
  });

  editor.addEventListener("paste", (event) => {
    if (!event.clipboardData) {
      return;
    }
    event.preventDefault();
    insertPlainText(event.clipboardData.getData("text/plain"));
  });

  copyButton.addEventListener("click", copyDocument);

  clearButton.addEventListener("click", () => {
    if (editor.innerHTML && !window.confirm("Clear all text in this document?")) {
      return;
    }
    editor.replaceChildren();
    updateCounts();
    setStatus("Document cleared");
    saveDocument();
    editor.focus();
  });

  try {
    const savedDocument = localStorage.getItem(storageKey);
    if (savedDocument !== null) {
      editor.textContent = savedDocument;
      setStatus("Document restored");
    }
  } catch (error) {
    reportStorageError("restore", error);
  }

  updateCounts();
  window.setInterval(saveDocument, 2000);
  window.addEventListener("pagehide", saveDocument);
})();
