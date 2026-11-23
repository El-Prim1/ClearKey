(() => {
  const storageKey = "clearkey.currentDocument";
  const settingsStorageKey = "clearkey.settings";
  const editor = document.querySelector("#writing-input");
  const wordCount = document.querySelector("#word-count");
  const characterCount = document.querySelector("#character-count");
  const documentStatus = document.querySelector("#document-status");
  const copyButton = document.querySelector(".copy-action");
  const clearButton = document.querySelector(".clear-action");
  const checkButton = document.querySelector("#check-button");
  const checkButtonLabel = checkButton.querySelector("span");
  const languageSelect = document.querySelector("#language-select");
  const toneSelect = document.querySelector("#tone-select");
  const suggestionsContent = document.querySelector(".suggestions-content");
  const suggestionsEmpty = document.querySelector("#suggestions-empty");
  const suggestionsEmptyTitle = document.querySelector("#suggestions-empty-title");
  const suggestionsEmptyDescription = document.querySelector("#suggestions-empty-description");
  const suggestionsList = document.querySelector("#suggestions-list");
  const suggestionCount = document.querySelector("#suggestion-count");
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

  function getApiEndpoint(path) {
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
    url.pathname = `${basePath}/${path}`;
    return url.href;
  }

  function getModelsEndpoint() {
    return getApiEndpoint("models");
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

  function createSystemPrompt() {
    const language = languageSelect.value === "auto"
      ? "Detect the input language. Write every explanation in that detected language."
      : `Review the text using ${languageSelect.selectedOptions[0].textContent} conventions, and write every explanation in that language. Do not translate the text.`;

    return [
      "You are a careful writing checker. Review the user's text for grammar, spelling, wrong word choice, awkward or meaningless sentences, and punctuation.",
      `Respect the selected tone: ${toneSelect.value}. Keep the author's meaning and voice; suggest only useful corrections.`,
      language,
      "Return STRICT valid JSON only. Do not return markdown, code fences, or any text outside the JSON object.",
      "Use exactly this structure:",
      '{"detected_language":"en","suggestions":[{"id":1,"category":"grammar","original":"exact substring","replacement":"corrected version","explanation":"short explanation in detected language","start":0,"end":10}]}',
      'Each category must be exactly "grammar", "clarity", or "punctuation".',
      "Use grammar for grammar, spelling, and incorrect word choice; clarity for awkward or meaningless sentences; punctuation for punctuation.",
      "Use unique integer IDs. The original must be an exact substring of the user's text.",
      "start is the zero-based inclusive offset and end is the zero-based exclusive offset, measured in UTF-16 code units in the original text.",
      "Do not overlap suggestions. If no corrections are needed, return an empty suggestions array.",
      "If Auto-detect is selected, detected_language must be the detected language's ISO 639-1 code. Otherwise use the selected language's ISO 639-1 code."
    ].join("\n");
  }

  function extractJsonObject(text) {
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (start < 0) {
        if (character === "{") {
          start = index;
          depth = 1;
        }
        continue;
      }

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, index + 1);
        }
      }
    }

    return null;
  }

  function parseSuggestions(content, sourceText) {
    let payload;
    let recovered = false;

    try {
      payload = JSON.parse(content);
    } catch {
      const jsonObject = extractJsonObject(content);
      if (!jsonObject) {
        throw new Error("The model response did not contain a valid JSON object.");
      }
      try {
        payload = JSON.parse(jsonObject);
        recovered = true;
      } catch {
        throw new Error("Could not recover valid JSON from the model response.");
      }
    }

    if (
      !payload
      || typeof payload.detected_language !== "string"
      || !Array.isArray(payload.suggestions)
    ) {
      throw new Error("The model response is missing detected_language or the suggestions array.");
    }

    const categories = ["grammar", "clarity", "punctuation"];
    const validSuggestions = [];
    let skippedCount = 0;

    payload.suggestions.forEach((suggestion) => {
      if (
        !suggestion
        || !Number.isInteger(suggestion.id)
        || !categories.includes(suggestion.category)
        || typeof suggestion.original !== "string"
        || typeof suggestion.replacement !== "string"
        || typeof suggestion.explanation !== "string"
        || !Number.isInteger(suggestion.start)
        || !Number.isInteger(suggestion.end)
        || suggestion.start < 0
        || suggestion.end < suggestion.start
        || suggestion.end > sourceText.length
        || sourceText.slice(suggestion.start, suggestion.end) !== suggestion.original
      ) {
        skippedCount += 1;
        return;
      }
      validSuggestions.push(suggestion);
    });

    return {
      detectedLanguage: payload.detected_language,
      suggestions: validSuggestions,
      skippedCount,
      recovered
    };
  }

  function renderSuggestions(suggestions) {
    suggestionsList.replaceChildren();
    suggestionCount.textContent = String(suggestions.length);

    if (suggestions.length === 0) {
      suggestionsEmpty.hidden = false;
      suggestionsList.hidden = true;
      suggestionsContent.classList.remove("has-suggestions");
      suggestionsEmptyTitle.textContent = "No suggestions found";
      suggestionsEmptyDescription.textContent = "Your text looks good as written.";
      return;
    }

    suggestionsEmpty.hidden = true;
    suggestionsList.hidden = false;
    suggestionsContent.classList.add("has-suggestions");

    suggestions.forEach((suggestion) => {
      const item = document.createElement("li");
      item.className = "suggestion-card";

      const heading = document.createElement("div");
      heading.className = "suggestion-card-heading";
      const category = document.createElement("span");
      category.className = `suggestion-category suggestion-category-${suggestion.category}`;
      category.textContent = suggestion.category;
      heading.append(category);

      const textPair = document.createElement("div");
      textPair.className = "suggestion-text-pair";
      const originalLabel = document.createElement("span");
      originalLabel.textContent = "Original";
      const original = document.createElement("p");
      original.className = "suggestion-original";
      original.textContent = suggestion.original;
      const replacementLabel = document.createElement("span");
      replacementLabel.textContent = "Suggestion";
      const replacement = document.createElement("p");
      replacement.className = "suggestion-replacement";
      replacement.textContent = suggestion.replacement;
      textPair.append(originalLabel, original, replacementLabel, replacement);

      const explanation = document.createElement("p");
      explanation.className = "suggestion-explanation";
      explanation.textContent = suggestion.explanation;
      item.append(heading, textPair, explanation);
      suggestionsList.append(item);
    });
  }

  function resetSuggestions() {
    suggestionsList.replaceChildren();
    suggestionCount.textContent = "0";
    suggestionsEmpty.hidden = false;
    suggestionsList.hidden = true;
    suggestionsContent.classList.remove("has-suggestions");
    suggestionsEmptyTitle.textContent = "Nothing to suggest — yet";
    suggestionsEmptyDescription.textContent = "Your writing suggestions will show up here once you start.";
  }

  async function checkText() {
    const text = getEditorText();
    if (!text.trim()) {
      showToast("Write or paste some text before checking.", "error");
      editor.focus();
      return;
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast("Enter an API key before checking.", "error");
      apiKeyInput.focus();
      return;
    }

    const model = modelNameInput.value.trim();
    if (!model) {
      showToast("Enter a model name before checking.", "error");
      modelNameInput.focus();
      return;
    }

    let endpoint;
    try {
      endpoint = getApiEndpoint("chat/completions");
    } catch (error) {
      showToast(error.message, "error");
      baseUrlInput.focus();
      return;
    }

    checkButton.disabled = true;
    checkButton.classList.add("is-loading");
    checkButtonLabel.textContent = "Checking…";

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: createSystemPrompt() },
            { role: "user", content: text }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal
      });

      const responseText = await response.text();
      if (!response.ok) {
        const providerMessage = getProviderErrorMessage(responseText);
        if (response.status === 401) {
          showToast(
            providerMessage
              ? `Invalid API key (401): ${providerMessage}`
              : "Invalid API key (401).",
            "error"
          );
        } else if (response.status === 404) {
          showToast(
            providerMessage
              ? `Base URL or /chat/completions endpoint not found (404): ${providerMessage}`
              : "Base URL or /chat/completions endpoint not found (404).",
            "error"
          );
        } else {
          showToast(
            providerMessage
              ? `Provider error (${response.status}): ${providerMessage}`
              : `Provider returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
            "error"
          );
        }
        return;
      }

      let providerResponse;
      try {
        providerResponse = JSON.parse(responseText);
      } catch {
        throw new Error("The provider returned an invalid response.");
      }

      const choices = providerResponse && providerResponse.choices;
      const message = Array.isArray(choices) && choices[0] && choices[0].message;
      let content = message && message.content;
      if (Array.isArray(content)) {
        content = content
          .filter((part) => part && typeof part.text === "string")
          .map((part) => part.text)
          .join("");
      }
      if (typeof content !== "string") {
        throw new Error("The provider response did not include assistant text.");
      }

      const result = parseSuggestions(content, text);
      if (getEditorText() !== text) {
        showToast("Text changed while checking. Run Check again to review the latest version.", "error");
        return;
      }
      renderSuggestions(result.suggestions);
      console.log("ClearKey suggestions:", {
        detected_language: result.detectedLanguage,
        suggestions: result.suggestions
      });

      if (result.recovered) {
        console.warn("ClearKey recovered a JSON object from surrounding model response text.");
      }
      if (result.skippedCount > 0) {
        const label = result.skippedCount === 1 ? "suggestion was" : "suggestions were";
        showToast(`${result.skippedCount} malformed ${label} skipped.`, "error");
      } else {
        const countLabel = result.suggestions.length === 1 ? "suggestion" : "suggestions";
        showToast(
          result.suggestions.length > 0
            ? `${result.suggestions.length} ${countLabel} found.`
            : "No suggestions found.",
          "success"
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        showToast("Check timed out. Try again or verify the provider endpoint.", "error");
      } else if (error instanceof TypeError) {
        showToast(
          `Network/CORS error: ${error.message || "Could not reach the provider."} Check the URL, connection, and provider CORS settings.`,
          "error"
        );
      } else {
        console.error("ClearKey could not complete the text check.", error);
        showToast(error.message || "The text check could not be completed.", "error");
      }
    } finally {
      window.clearTimeout(timeout);
      checkButton.disabled = false;
      checkButton.classList.remove("is-loading");
      checkButtonLabel.textContent = "Check";
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

  checkButton.addEventListener("click", checkText);

  loadSettings();

  function getEditorText() {
    const text = editor.innerText.replace(/\r\n?/g, "\n");
    if ((!editor.textContent && !text.trim()) || editor.innerHTML === "\n") {
      return "";
    }
    return text;
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
    resetSuggestions();
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
