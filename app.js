(() => {
  const storageKey = "clearkey.currentDocument";
  const settingsStorageKey = "clearkey.settings";
  const setupDismissedStorageKey = "clearkey.setupDismissed";
  const documentsStorageKey = "clearkey.documents";
  const activeDocumentStorageKey = "clearkey.activeDocument";
  const editor = document.querySelector("#writing-input");
  const wordCount = document.querySelector("#word-count");
  const characterCount = document.querySelector("#character-count");
  const documentStatus = document.querySelector("#document-status");
  const copyButton = document.querySelector(".copy-action");
  const clearButton = document.querySelector(".clear-action");
  const checkButton = document.querySelector("#check-button");
  const checkButtonLabel = checkButton.querySelector("span");
  const autoCheckInput = document.querySelector("#auto-check");
  const checkInfoBar = document.querySelector("#check-info-bar");
  const checkStatus = document.querySelector("#check-status");
  const checkStatusHint = document.querySelector("#check-status-hint");
  const inputTokenCount = document.querySelector("#input-token-count");
  const outputTokenCount = document.querySelector("#output-token-count");
  const totalTokenCount = document.querySelector("#total-token-count");
  const tokenPriceInput = document.querySelector("#token-price");
  const costSummary = document.querySelector("#cost-summary");
  const priceHint = document.querySelector("#price-hint");
  const languageSelect = document.querySelector("#language-select");
  const toneSelect = document.querySelector("#tone-select");
  const suggestionsContent = document.querySelector(".suggestions-content");
  const suggestionsEmpty = document.querySelector("#suggestions-empty");
  const suggestionsEmptyTitle = document.querySelector("#suggestions-empty-title");
  const suggestionsEmptyDescription = document.querySelector("#suggestions-empty-description");
  const suggestionsList = document.querySelector("#suggestions-list");
  const suggestionCount = document.querySelector("#suggestions-title-count");
  const issueCount = document.querySelector("#issue-count");
  const suggestionBulkActions = document.querySelector("#suggestion-bulk-actions");
  const suggestionPopup = document.querySelector("#suggestion-popup");
  const settingsForm = document.querySelector("#settings-form");
  const baseUrlInput = document.querySelector("#base-url");
  const modelNameInput = document.querySelector("#model-name");
  const apiKeyInput = document.querySelector("#api-key");
  const toggleApiKeyButton = document.querySelector("#toggle-api-key");
  const testKeyButton = document.querySelector("#test-key");
  const toast = document.querySelector("#toast");
  const documentTitleInput = document.querySelector("#document-title");
  const editorView = document.querySelector("#editor-view");
  const documentsView = document.querySelector("#documents-view");
  const settingsView = document.querySelector("#settings-view");
  const documentsGrid = document.querySelector("#documents-grid");
  const documentsEmpty = document.querySelector("#documents-empty");
  const documentsNav = document.querySelector("#documents-nav");
  const settingsNav = document.querySelector("#settings-nav");
  const brandHome = document.querySelector("#brand-home");
  const newDocumentButton = document.querySelector("#new-document");
  const emptyNewDocumentButton = document.querySelector("#empty-new-document");
  const setupModal = document.querySelector("#setup-modal");
  const setupCloseButton = document.querySelector("#setup-close");
  const setupSkipButton = document.querySelector("#setup-skip");
  const setupBackButton = document.querySelector("#setup-back");
  const setupNextButton = document.querySelector("#setup-next");
  const setupFinishButton = document.querySelector("#setup-finish");
  const setupTestButton = document.querySelector("#setup-test-key");
  const setupTestStatus = document.querySelector("#setup-test-status");
  const setupBaseUrlInput = document.querySelector("#setup-base-url");
  const setupModelNameInput = document.querySelector("#setup-model-name");
  const setupApiKeyInput = document.querySelector("#setup-api-key");
  const trySampleButton = document.querySelector("#try-sample");
  let storageErrorLogged = false;
  let settingsSaveErrorLogged = false;
  let toastTimer = 0;
  let activeSuggestions = [];
  let popupAnchor = null;
  let autoCheckTimer = 0;
  let checkInProgress = false;
  let pendingAutoCheck = false;
  let lastUsage = null;
  let sessionTokens = 0;
  let currentSetupStep = 1;
  let documents = [];
  let activeDocumentId = null;
  let currentView = "editor";
  let fetchedModels = [];

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, type === "error" ? 10000 : 6000);
  }

  function showSetupStep(step) {
    currentSetupStep = step;
    document.querySelectorAll("[data-setup-step]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.setupStep) !== step;
    });
    document.querySelectorAll("[data-step-indicator]").forEach((indicator) => {
      const indicatorStep = Number(indicator.dataset.stepIndicator);
      indicator.classList.toggle("is-active", indicatorStep === step);
      indicator.classList.toggle("is-complete", indicatorStep < step);
    });
    setupBackButton.hidden = step === 1;
    setupNextButton.hidden = step === 3;
    setupFinishButton.hidden = step !== 3;
  }

  function syncSetupFields() {
    setupBaseUrlInput.value = baseUrlInput.value;
    setupModelNameInput.value = modelNameInput.value;
    setupApiKeyInput.value = apiKeyInput.value;
  }

  function persistSetupDismissal() {
    try {
      localStorage.setItem(setupDismissedStorageKey, "true");
    } catch (error) {
      console.error("ClearKey could not save the setup dismissal in local storage.", error);
      showToast("Setup preference could not be saved in this browser.", "error");
    }
  }

  function maybeOpenSetupModal() {
    if (apiKeyInput.value.trim()) {
      return;
    }

    let setupDismissed = false;
    try {
      setupDismissed = localStorage.getItem(setupDismissedStorageKey) === "true";
    } catch (error) {
      console.error("ClearKey could not read the setup preference from local storage.", error);
      showToast("Setup preference could not be read in this browser.", "error");
    }

    if (!setupDismissed) {
      showSetupStep(1);
      setupModal.showModal();
      setupBaseUrlInput.focus();
    }
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

  function getWordTotal(text) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/u).length : 0;
  }

  function saveDocumentIndex() {
    try {
      localStorage.setItem(documentsStorageKey, JSON.stringify(documents));
      if (activeDocumentId) {
        localStorage.setItem(activeDocumentStorageKey, activeDocumentId);
      } else {
        localStorage.removeItem(activeDocumentStorageKey);
      }
      return true;
    } catch (error) {
      console.error("ClearKey could not save the documents list.", error);
      showToast("Documents could not be saved in this browser.", "error");
      return false;
    }
  }

  function updateActiveDocumentRecord(text = getEditorText()) {
    if (!activeDocumentId) {
      if (!text.trim()) {
        return;
      }
      activeDocumentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    const title = documentTitleInput.value.trim() || "Untitled document";
    const now = new Date().toISOString();
    const existing = documents.find((item) => item.id === activeDocumentId);
    if (existing) {
      const changed = existing.title !== title || existing.content !== text;
      existing.title = title;
      existing.content = text;
      if (changed) {
        existing.updatedAt = now;
      }
      existing.wordCount = getWordTotal(text);
    } else {
      documents.unshift({
        id: activeDocumentId,
        title,
        content: text,
        updatedAt: now,
        wordCount: getWordTotal(text)
      });
    }
    saveDocumentIndex();
  }

  function renderDocuments() {
    documentsGrid.replaceChildren();
    documentsEmpty.hidden = documents.length > 0;

    documents
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .forEach((item) => {
        const card = document.createElement("article");
        card.className = "document-tile";
        card.dataset.documentId = item.id;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Open ${item.title || "Untitled document"}`);

        const preview = document.createElement("div");
        preview.className = "document-tile-preview";
        const lines = (item.content || "").split(/\s+/u).filter(Boolean);
        const excerpts = [];
        for (let index = 0; index < 4; index += 1) {
          excerpts.push(lines.slice(index * 9, (index + 1) * 9).join(" "));
        }
        excerpts.forEach((text, index) => {
          const line = document.createElement("span");
          line.className = `preview-line preview-line-${index + 1}`;
          line.textContent = text || (lines.length ? "" : " ");
          preview.append(line);
        });

        const details = document.createElement("div");
        details.className = "document-tile-details";
        const title = document.createElement("strong");
        title.className = "document-tile-title";
        title.textContent = item.title || "Untitled document";
        const metadata = document.createElement("span");
        metadata.className = "document-tile-meta";
        metadata.textContent = `Last edited · ${getWordTotal(item.content || "")} words`;
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-document-button";
        deleteButton.dataset.deleteDocument = item.id;
        deleteButton.setAttribute("aria-label", `Delete ${item.title || "Untitled document"}`);
        deleteButton.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m3 0-.7 10H5.7L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 9v4m3-4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
        details.append(title, metadata, deleteButton);
        card.append(preview, details);
        documentsGrid.append(card);
      });
  }

  function setView(view) {
    currentView = view;
    editorView.hidden = view !== "editor";
    documentsView.hidden = view !== "documents";
    settingsView.hidden = view !== "settings";
    documentsNav.setAttribute("aria-current", String(view === "documents"));
    settingsNav.setAttribute("aria-current", String(view === "settings"));
    brandHome.setAttribute("aria-current", String(view === "editor"));
    if (view === "documents") {
      renderDocuments();
    }
  }

  function openDocument(documentId) {
    const record = documents.find((item) => item.id === documentId);
    if (!record) {
      showToast("That document could not be found.", "error");
      renderDocuments();
      return;
    }

    activeDocumentId = record.id;
    documentTitleInput.value = record.title || "Untitled document";
    editor.textContent = record.content || "";
    resetSuggestions();
    updateCounts();
    saveDocument();
    setView("editor");
    setStatus("Document opened");
    editor.focus();
  }

  function createNewDocument() {
    if (getEditorText().trim() && !window.confirm("Save this document and create a new one?")) {
      return;
    }

    saveDocument();
    activeDocumentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    documentTitleInput.value = "Untitled document";
    editor.replaceChildren();
    resetSuggestions();
    updateCounts();
    saveDocument();
    setView("editor");
    editor.focus();
    showToast("New document created.", "success");
  }

  function deleteDocument(documentId) {
    const record = documents.find((item) => item.id === documentId);
    if (!record || !window.confirm(`Delete "${record.title || "Untitled document"}"? This cannot be undone.`)) {
      return;
    }

    documents = documents.filter((item) => item.id !== documentId);
    if (activeDocumentId === documentId) {
      activeDocumentId = null;
      documentTitleInput.value = "Untitled document";
      editor.replaceChildren();
      resetSuggestions();
      updateCounts();
      try {
        localStorage.setItem(storageKey, "");
      } catch (error) {
        console.error("ClearKey could not clear the active document.", error);
        showToast("The active document could not be cleared from this browser.", "error");
      }
    }
    saveDocumentIndex();
    renderDocuments();
    showToast("Document deleted.", "success");
  }

  function loadDocuments() {
    try {
      const savedDocuments = localStorage.getItem(documentsStorageKey);
      if (savedDocuments !== null) {
        const parsedDocuments = JSON.parse(savedDocuments);
        if (!Array.isArray(parsedDocuments)) {
          throw new Error("Saved documents have an invalid format.");
        }
        documents = parsedDocuments.filter((item) => (
          item
          && typeof item.id === "string"
          && typeof item.title === "string"
          && typeof item.content === "string"
          && typeof item.updatedAt === "string"
        ));
      }
      activeDocumentId = localStorage.getItem(activeDocumentStorageKey);
    } catch (error) {
      console.error("ClearKey could not load documents from local storage.", error);
      showToast("Saved documents could not be loaded from this browser.", "error");
      documents = [];
      activeDocumentId = null;
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

  function setSetupTestStatus(message, state) {
    setupTestStatus.textContent = message;
    if (state) {
      setupTestStatus.dataset.state = state;
    } else {
      delete setupTestStatus.dataset.state;
    }
  }

  function focusSettingInput(input) {
    if (!setupModal.open) {
      input.focus();
      return;
    }

    if (input === baseUrlInput) {
      showSetupStep(1);
      setupBaseUrlInput.focus();
    } else if (input === modelNameInput) {
      showSetupStep(2);
      setupModelNameInput.focus();
    } else {
      showSetupStep(3);
      setupApiKeyInput.focus();
    }
  }

  async function testApiKey(triggerButton = testKeyButton) {
    const isSetupTest = triggerButton === setupTestButton;
    const buttonLabel = triggerButton.querySelector("span");
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      if (isSetupTest) {
        setSetupTestStatus("Paste your API key first.", "error");
      }
      showToast("Enter an API key before testing the connection.", "error");
      focusSettingInput(apiKeyInput);
      return;
    }

    let endpoint;
    try {
      endpoint = getModelsEndpoint();
    } catch (error) {
      if (isSetupTest) {
        setSetupTestStatus(error.message, "error");
      }
      showToast(error.message, "error");
      focusSettingInput(baseUrlInput);
      return;
    }

    if (isSetupTest) {
      setSetupTestStatus("Testing connection…", "checking");
    }
    triggerButton.disabled = true;
    triggerButton.classList.add("is-loading");
    buttonLabel.textContent = "Testing…";

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
        if (isSetupTest) {
          setSetupTestStatus("Connected", "success");
        }
        showToast("Connected", "success");
        if (isSetupTest && setupModal.open) {
          setupModal.close();
        }
        return;
      }

      const providerMessage = getProviderErrorMessage(await response.text());
      if (response.status === 401) {
        const message = providerMessage
          ? `Invalid API key (401): ${providerMessage}`
          : "Invalid API key (401).";
        if (isSetupTest) {
          setSetupTestStatus(message, "error");
        }
        showToast(
          message,
          "error"
        );
        return;
      }
      if (response.status === 404) {
        const message = providerMessage
          ? `Base URL or /models endpoint not found (404): ${providerMessage}`
          : "Base URL or /models endpoint not found (404).";
        if (isSetupTest) {
          setSetupTestStatus(message, "error");
        }
        showToast(
          message,
          "error"
        );
        return;
      }

      const errorMessage = providerMessage
        ? `Provider error (${response.status}): ${providerMessage}`
        : `Provider returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`;
      if (isSetupTest) {
        setSetupTestStatus(errorMessage, "error");
      }
      showToast(errorMessage, "error");
    } catch (error) {
      if (error.name === "AbortError") {
        const message = "Connection timed out. Check the Base URL and try again.";
        if (isSetupTest) {
          setSetupTestStatus(message, "error");
        }
        showToast(message, "error");
      } else if (error instanceof TypeError) {
        const message = `Network/CORS error: ${error.message || "Could not reach the provider."} Check the URL, connection, and provider CORS settings.`;
        if (isSetupTest) {
          setSetupTestStatus(message, "error");
        }
        showToast(message, "error");
      } else {
        const message = `Could not test the API key: ${error.message || "Unexpected error."}`;
        if (isSetupTest) {
          setSetupTestStatus(message, "error");
        }
        showToast(message, "error");
      }
    } finally {
      window.clearTimeout(timeout);
      triggerButton.disabled = false;
      triggerButton.classList.remove("is-loading");
      buttonLabel.textContent = "Test Key";
    }
  }

  async function fetchAvailableModels() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast("Enter an API key before fetching models.", "error");
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

    const button = document.querySelector("#fetch-models");
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Fetching…";
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        credentials: "omit",
        redirect: "error"
      });
      if (!response.ok) {
        const providerMessage = getProviderErrorMessage(await response.text());
        throw new Error(providerMessage
          ? `Provider error (${response.status}): ${providerMessage}`
          : `Provider returned HTTP ${response.status}.`);
      }

      const payload = await response.json();
      if (!payload || !Array.isArray(payload.data)) {
        throw new Error("The provider response did not contain a models list.");
      }
      fetchedModels = payload.data
        .map((item) => item && item.id)
        .filter((id) => typeof id === "string" && id.trim());
      const modelList = document.querySelector("#available-models");
      modelList.replaceChildren();
      fetchedModels.forEach((model) => {
        const option = document.createElement("option");
        option.value = model;
        modelList.append(option);
      });
      showToast(
        fetchedModels.length
          ? `${fetchedModels.length} models loaded. Select or enter a model.`
          : "No models were returned by the provider.",
        fetchedModels.length ? "success" : "error"
      );
    } catch (error) {
      console.error("ClearKey could not fetch the provider's models.", error);
      showToast(
        error.name === "TypeError"
          ? "Network/CORS error while fetching models. Check the URL and provider CORS settings."
          : error.message || "Could not fetch models.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
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
      'Each category must be exactly "grammar", "spelling", "clarity", or "punctuation".',
      "Use grammar for grammar and incorrect word choice; spelling only for misspelled words and typos; clarity for awkward or meaningless sentences; punctuation for punctuation.",
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

    const categories = ["grammar", "spelling", "clarity", "punctuation"];
    const validSuggestions = [];
    let skippedCount = 0;

    payload.suggestions.forEach((suggestion, index) => {
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
      validSuggestions.push({ ...suggestion, key: `suggestion-${index}` });
    });

    return {
      detectedLanguage: payload.detected_language,
      suggestions: validSuggestions,
      skippedCount,
      recovered
    };
  }

  function appendTextWithBreaks(container, text) {
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) {
        container.append(document.createElement("br"));
      }
      if (line) {
        container.append(document.createTextNode(line));
      }
    });
  }

  function renderEditorHighlights(text, suggestions) {
    editor.replaceChildren();
    const points = new Set([0, text.length]);
    suggestions.forEach((suggestion) => {
      points.add(suggestion.start);
      points.add(suggestion.end);
    });
    const offsets = Array.from(points).sort((left, right) => left - right);

    offsets.forEach((start, index) => {
      const insertionSuggestions = suggestions.filter(
        (suggestion) => suggestion.start === start && suggestion.end === start
      );
      insertionSuggestions.forEach((suggestion) => {
        const marker = document.createElement("span");
        marker.className = `suggestion-highlight suggestion-highlight-${suggestion.category} suggestion-insertion-marker`;
        marker.dataset.suggestionKeys = JSON.stringify([suggestion.key]);
        marker.setAttribute("aria-label", `${suggestion.category} suggestion`);
        editor.append(marker);
      });

      if (index === offsets.length - 1) {
        return;
      }

      const end = offsets[index + 1];
      if (end <= start) {
        return;
      }
      const segment = text.slice(start, end);
      const overlapping = suggestions.filter(
        (suggestion) => suggestion.start < end && suggestion.end > start
      );
      if (overlapping.length === 0) {
        appendTextWithBreaks(editor, segment);
        return;
      }

      const highlight = document.createElement("span");
      highlight.className = `suggestion-highlight suggestion-highlight-${overlapping[0].category}`;
      highlight.dataset.suggestionKeys = JSON.stringify(overlapping.map((suggestion) => suggestion.key));
      appendTextWithBreaks(highlight, segment);
      editor.append(highlight);
    });

    editor.dataset.empty = String(text.length === 0);
  }

  function clearEditorHighlights() {
    Array.from(editor.querySelectorAll(".suggestion-highlight")).forEach((highlight) => {
      if (highlight.classList.contains("suggestion-insertion-marker")) {
        highlight.remove();
        return;
      }
      const parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);
    });
  }

  function renderSuggestions(suggestions) {
    suggestionsList.replaceChildren();
    suggestionCount.textContent = String(suggestions.length);
    issueCount.textContent = String(suggestions.length);
    suggestionBulkActions.hidden = suggestions.length === 0;

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
      category.textContent = suggestion.category === "spelling" ? "Spelling / Typo" : suggestion.category;
      heading.append(category);
      const suggestionId = document.createElement("small");
      suggestionId.textContent = `#${suggestion.id}`;
      heading.append(suggestionId);

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
      const actions = document.createElement("div");
      actions.className = "suggestion-card-actions";
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "apply-suggestion-button";
      applyButton.dataset.suggestionKey = suggestion.key;
      applyButton.dataset.suggestionAction = "apply";
      applyButton.textContent = "Apply";
      const ignoreButton = document.createElement("button");
      ignoreButton.type = "button";
      ignoreButton.className = "ignore-suggestion-button";
      ignoreButton.dataset.suggestionKey = suggestion.key;
      ignoreButton.dataset.suggestionAction = "ignore";
      ignoreButton.textContent = "Ignore";
      actions.append(applyButton, ignoreButton);
      item.dataset.category = suggestion.category;
      item.classList.add(`suggestion-card-${suggestion.category}`);
      item.append(heading, textPair, explanation, actions);
      suggestionsList.append(item);
    });
  }

  function resetSuggestions() {
    activeSuggestions = [];
    clearEditorHighlights();
    closeSuggestionPopup();
    suggestionsList.replaceChildren();
    suggestionCount.textContent = "0";
    issueCount.textContent = "0";
    suggestionBulkActions.hidden = true;
    suggestionsEmpty.hidden = false;
    suggestionsList.hidden = true;
    suggestionsContent.classList.remove("has-suggestions");
    suggestionsEmptyTitle.textContent = "Nothing to suggest — yet";
    suggestionsEmptyDescription.textContent = "Your writing suggestions will show up here once you start.";
  }

  function closeSuggestionPopup() {
    suggestionPopup.hidden = true;
    popupAnchor = null;
  }

  function positionSuggestionPopup() {
    if (suggestionPopup.hidden || !popupAnchor || !popupAnchor.isConnected) {
      return;
    }

    const anchorRect = popupAnchor.getBoundingClientRect();
    const popupRect = suggestionPopup.getBoundingClientRect();
    const margin = 12;
    let left = Math.min(anchorRect.left, window.innerWidth - popupRect.width - margin);
    left = Math.max(margin, left);

    let top = anchorRect.bottom + 8;
    if (top + popupRect.height > window.innerHeight - margin) {
      top = anchorRect.top - popupRect.height - 8;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - popupRect.height - margin));

    suggestionPopup.style.left = `${left}px`;
    suggestionPopup.style.top = `${top}px`;
  }

  function createPopupAction(label, action, key, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.popupAction = action;
    if (key) {
      button.dataset.suggestionKey = key;
    }
    button.textContent = label;
    return button;
  }

  function openSuggestionPopup(highlight) {
    let keys;
    try {
      keys = JSON.parse(highlight.dataset.suggestionKeys);
    } catch {
      return;
    }
    const suggestions = activeSuggestions.filter((suggestion) => keys.includes(suggestion.key));
    if (suggestions.length === 0) {
      return;
    }

    suggestionPopup.replaceChildren();
    popupAnchor = highlight;

    suggestions.forEach((suggestion) => {
      const card = document.createElement("section");
      card.className = "popup-suggestion";
      card.dataset.category = suggestion.category;

      const heading = document.createElement("div");
      heading.className = "popup-suggestion-heading";
      const category = document.createElement("span");
      category.className = `suggestion-category suggestion-category-${suggestion.category}`;
      category.textContent = suggestion.category === "spelling" ? "Spelling / Typo" : suggestion.category;
      const title = document.createElement("strong");
      title.textContent = `Suggestion #${suggestion.id}`;
      heading.append(category, title);

      const explanation = document.createElement("p");
      explanation.className = "popup-explanation";
      explanation.textContent = suggestion.explanation;

      const originalReplacement = document.createElement("p");
      originalReplacement.className = "popup-original-replacement";
      const original = document.createElement("span");
      original.className = "popup-original";
      original.textContent = suggestion.original || "(insert)";
      const arrow = document.createElement("span");
      arrow.className = "popup-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      const replacement = document.createElement("span");
      replacement.className = "popup-replacement";
      replacement.textContent = suggestion.replacement || "(delete)";
      originalReplacement.append(original, arrow, replacement);

      const actions = document.createElement("div");
      actions.className = "popup-actions";
      actions.append(
        createPopupAction("Apply", "apply", suggestion.key, "apply-suggestion-button"),
        createPopupAction("Ignore", "ignore", suggestion.key, "ignore-suggestion-button")
      );
      card.append(heading, explanation, originalReplacement, actions);
      suggestionPopup.append(card);
    });

    const dismissRow = document.createElement("div");
    dismissRow.className = "popup-dismiss-row";
    dismissRow.append(createPopupAction("Dismiss", "dismiss", "", "popup-dismiss"));
    suggestionPopup.append(dismissRow);
    suggestionPopup.hidden = false;
    positionSuggestionPopup();
  }

  function setCaretAtTextOffset(offset) {
    editor.focus();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    let consumed = 0;
    let targetNode = null;
    let targetOffset = 0;

    function findPosition(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.nodeValue.length;
        if (offset <= consumed + length) {
          targetNode = node;
          targetOffset = Math.max(0, offset - consumed);
          return true;
        }
        consumed += length;
        return false;
      }

      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
        const parent = node.parentNode;
        const index = Array.prototype.indexOf.call(parent.childNodes, node);
        if (offset === consumed) {
          targetNode = parent;
          targetOffset = index;
          return true;
        }
        consumed += 1;
        if (offset === consumed) {
          targetNode = parent;
          targetOffset = index + 1;
          return true;
        }
        return false;
      }

      for (const child of node.childNodes) {
        if (findPosition(child)) {
          return true;
        }
      }
      return false;
    }

    findPosition(editor);
    const range = document.createRange();
    if (targetNode) {
      range.setStart(targetNode, targetOffset);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function suggestionsOverlap(first, second) {
    if (first.start === first.end && second.start === second.end) {
      return first.start === second.start;
    }
    if (first.start === first.end) {
      return first.start > second.start && first.start < second.end;
    }
    if (second.start === second.end) {
      return second.start > first.start && second.start < first.end;
    }
    return first.start < second.end && second.start < first.end;
  }

  function applySuggestion(key, notify = true) {
    const suggestion = activeSuggestions.find((item) => item.key === key);
    if (!suggestion) {
      return false;
    }

    const text = getEditorText();
    if (text.slice(suggestion.start, suggestion.end) !== suggestion.original) {
      resetSuggestions();
      showToast("This suggestion no longer matches the text. Run Check again.", "error");
      return false;
    }

    const updatedText = text.slice(0, suggestion.start)
      + suggestion.replacement
      + text.slice(suggestion.end);
    const offsetChange = suggestion.replacement.length - (suggestion.end - suggestion.start);
    const remaining = [];

    activeSuggestions.forEach((other) => {
      if (other.key === suggestion.key || suggestionsOverlap(suggestion, other)) {
        return;
      }
      if (other.end <= suggestion.start) {
        remaining.push(other);
      } else if (other.start >= suggestion.end) {
        remaining.push({
          ...other,
          start: other.start + offsetChange,
          end: other.end + offsetChange
        });
      }
    });

    closeSuggestionPopup();
    activeSuggestions = remaining;
    renderEditorHighlights(updatedText, remaining);
    updateCounts();
    renderSuggestions(remaining);
    saveDocument();
    setCaretAtTextOffset(suggestion.start + suggestion.replacement.length);
    if (notify) {
      showToast("Suggestion applied.", "success");
    }
    return true;
  }

  function ignoreSuggestion(key, notify = true) {
    if (!activeSuggestions.some((suggestion) => suggestion.key === key)) {
      return false;
    }

    closeSuggestionPopup();
    activeSuggestions = activeSuggestions.filter((suggestion) => suggestion.key !== key);
    renderEditorHighlights(getEditorText(), activeSuggestions);
    renderSuggestions(activeSuggestions);
    if (notify) {
      showToast("Suggestion ignored.", "success");
    }
    return true;
  }

  function applyAllSuggestions() {
    const keys = activeSuggestions
      .slice()
      .sort((left, right) => right.start - left.start || right.end - left.end)
      .map((suggestion) => suggestion.key);
    let appliedCount = 0;
    keys.forEach((key) => {
      if (applySuggestion(key, false)) {
        appliedCount += 1;
      }
    });
    closeSuggestionPopup();
    const suggestionLabel = appliedCount === 1 ? "suggestion" : "suggestions";
    showToast(
      appliedCount > 0 ? `${appliedCount} ${suggestionLabel} applied.` : "No suggestions were applied.",
      appliedCount > 0 ? "success" : "error"
    );
  }

  function ignoreAllSuggestions() {
    closeSuggestionPopup();
    activeSuggestions = [];
    renderEditorHighlights(getEditorText(), activeSuggestions);
    renderSuggestions(activeSuggestions);
    showToast("All suggestions ignored.", "success");
  }

  function setCheckStatus(message, state) {
    checkStatus.textContent = message;
    checkInfoBar.dataset.state = state;
  }

  function setCheckStatusHint(message) {
    checkStatusHint.textContent = message;
    checkStatusHint.hidden = !message;
  }

  function getTokenPrice() {
    const rawPrice = tokenPriceInput.value.trim();
    if (!rawPrice) {
      return null;
    }

    const price = Number(rawPrice);
    return Number.isFinite(price) && price >= 0 ? price : null;
  }

  function formatTokenCount(count) {
    return count.toLocaleString();
  }

  function updateCostSummary() {
    const price = getTokenPrice();
    priceHint.hidden = price !== null;
    tokenPriceInput.setAttribute("aria-invalid", String(price === null));

    if (!lastUsage) {
      costSummary.textContent = `Last check: — | Session: ${price === null ? "—" : `$${((sessionTokens / 1000000) * price).toFixed(4)}`}`;
      return;
    }

    const lastCost = price === null
      ? "—"
      : `$${((lastUsage.totalTokens / 1000000) * price).toFixed(4)}`;
    const sessionTotal = price === null
      ? "—"
      : `$${((sessionTokens / 1000000) * price).toFixed(4)}`;
    costSummary.textContent = `Last check: ${formatTokenCount(lastUsage.totalTokens)} tokens ~ ${lastCost} | Session: ${sessionTotal}`;
  }

  function getUsageCount(usage, names) {
    if (!usage || typeof usage !== "object") {
      return null;
    }

    for (const name of names) {
      const value = usage[name];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.round(value);
      }
    }
    return null;
  }

  function recordTokenUsage(usage, inputText, outputText) {
    const reportedInput = getUsageCount(usage, ["prompt_tokens", "input_tokens"]);
    const reportedOutput = getUsageCount(usage, ["completion_tokens", "output_tokens"]);
    const totalReported = getUsageCount(usage, ["total_tokens"]);
    const hasReportedBreakdown = reportedInput !== null && reportedOutput !== null;
    const inputTokens = hasReportedBreakdown
      ? reportedInput
      : Math.ceil(inputText.length / 4);
    const outputTokens = hasReportedBreakdown
      ? reportedOutput
      : Math.ceil(outputText.length / 4);
    const totalTokens = hasReportedBreakdown && totalReported !== null
      ? totalReported
      : inputTokens + outputTokens;

    lastUsage = { inputTokens, outputTokens, totalTokens };
    sessionTokens += totalTokens;
    inputTokenCount.textContent = formatTokenCount(inputTokens);
    outputTokenCount.textContent = formatTokenCount(outputTokens);
    totalTokenCount.textContent = formatTokenCount(totalTokens);
    updateCostSummary();
  }

  function scheduleAutoCheck() {
    window.clearTimeout(autoCheckTimer);
    autoCheckTimer = 0;
    pendingAutoCheck = false;

    if (!autoCheckInput.checked) {
      setCheckStatusHint("");
      return;
    }

    if (!apiKeyInput.value.trim()) {
      setCheckStatus("Idle", "idle");
      setCheckStatusHint("Add your API key to enable checking");
      return;
    }

    if (getEditorText().trim().length < 10) {
      setCheckStatus("Idle", "idle");
      setCheckStatusHint("Enter at least 10 characters to auto-check.");
      return;
    }

    setCheckStatusHint("");
    if (!checkInProgress) {
      setCheckStatus("Idle", "idle");
    }
    autoCheckTimer = window.setTimeout(() => {
      autoCheckTimer = 0;
      checkText({ automatic: true });
    }, 1500);
  }

  async function checkText(options = {}) {
    const automatic = options.automatic === true;
    if (checkInProgress) {
      if (automatic) {
        pendingAutoCheck = true;
      }
      return;
    }

    window.clearTimeout(autoCheckTimer);
    autoCheckTimer = 0;
    const text = getEditorText();
    if (!text.trim()) {
      setCheckStatus("Error", "error");
      setCheckStatusHint("");
      if (automatic) {
        return;
      }
      showToast("Write or paste some text before checking.", "error");
      editor.focus();
      return;
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      if (automatic) {
        setCheckStatus("Idle", "idle");
        setCheckStatusHint("Add your API key to enable checking");
        return;
      }
      setCheckStatus("Error", "error");
      setCheckStatusHint("");
      showToast("Enter an API key before checking.", "error");
      apiKeyInput.focus();
      return;
    }

    if (automatic && text.trim().length < 10) {
      setCheckStatus("Idle", "idle");
      setCheckStatusHint("Enter at least 10 characters to auto-check.");
      return;
    }

    const model = modelNameInput.value.trim();
    if (!model) {
      setCheckStatus("Error", "error");
      setCheckStatusHint("");
      showToast("Enter a model name before checking.", "error");
      modelNameInput.focus();
      return;
    }

    let endpoint;
    try {
      endpoint = getApiEndpoint("chat/completions");
    } catch (error) {
      setCheckStatus("Error", "error");
      setCheckStatusHint("");
      showToast(error.message, "error");
      baseUrlInput.focus();
      return;
    }

    checkInProgress = true;
    setCheckStatus("Checking...", "checking");
    setCheckStatusHint("");
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
        setCheckStatus("Error", "error");
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
      recordTokenUsage(
        providerResponse && providerResponse.usage,
        text,
        typeof content === "string" ? content : ""
      );
      if (typeof content !== "string") {
        throw new Error("The provider response did not include assistant text.");
      }

      const result = parseSuggestions(content, text);
      if (getEditorText() !== text) {
        if (automatic) {
          setCheckStatus("Idle", "idle");
        } else {
          setCheckStatus("Error", "error");
          showToast("Text changed while checking. Run Check again to review the latest version.", "error");
        }
        return;
      }
      closeSuggestionPopup();
      activeSuggestions = result.suggestions;
      renderEditorHighlights(text, activeSuggestions);
      updateCounts();
      renderSuggestions(activeSuggestions);
      setCheckStatus(`${result.suggestions.length} issues found`, "success");
      console.log("ClearKey suggestions:", {
        detected_language: result.detectedLanguage,
        suggestions: activeSuggestions
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
      setCheckStatus("Error", "error");
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
      checkInProgress = false;
      if (pendingAutoCheck) {
        pendingAutoCheck = false;
        if (autoCheckInput.checked) {
          checkText({ automatic: true });
        }
      }
    }
  }

  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings();
    testApiKey();
  });

  document.querySelector("#fetch-models").addEventListener("click", fetchAvailableModels);

  document.querySelectorAll("[data-provider-url]").forEach((button) => {
    button.addEventListener("click", () => {
      const providerUrl = button.dataset.providerUrl;
      if (providerUrl) {
        baseUrlInput.value = providerUrl;
        saveSettings();
        document.querySelectorAll("[data-provider-url]").forEach((preset) => {
          preset.classList.toggle("is-selected", preset === button);
        });
        showToast(`${button.textContent} Base URL selected.`, "success");
      } else {
        baseUrlInput.focus();
        document.querySelectorAll("[data-provider-url]").forEach((preset) => {
          preset.classList.toggle("is-selected", preset === button);
        });
      }
    });
  });

  [
    [baseUrlInput, setupBaseUrlInput],
    [modelNameInput, setupModelNameInput],
    [apiKeyInput, setupApiKeyInput]
  ].forEach(([settingsInput, setupInput]) => {
    settingsInput.addEventListener("input", () => {
      setupInput.value = settingsInput.value;
      saveSettings();
      scheduleAutoCheck();
    });

    setupInput.addEventListener("input", () => {
      settingsInput.value = setupInput.value;
      saveSettings();
      scheduleAutoCheck();
      setSetupTestStatus("", "");
    });
  });

  editor.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      checkText();
    }
  });

  toggleApiKeyButton.addEventListener("click", () => {
    const shouldShowKey = apiKeyInput.type === "password";
    apiKeyInput.type = shouldShowKey ? "text" : "password";
    toggleApiKeyButton.setAttribute("aria-label", shouldShowKey ? "Hide API key" : "Show API key");
    toggleApiKeyButton.setAttribute("aria-pressed", String(shouldShowKey));
    toggleApiKeyButton.querySelector(".eye-icon").hidden = shouldShowKey;
    toggleApiKeyButton.querySelector(".eye-off-icon").hidden = !shouldShowKey;
  });

  checkButton.addEventListener("click", () => checkText());

  autoCheckInput.addEventListener("change", () => {
    if (autoCheckInput.checked) {
      scheduleAutoCheck();
      return;
    }

    window.clearTimeout(autoCheckTimer);
    autoCheckTimer = 0;
    pendingAutoCheck = false;
    setCheckStatusHint("");
    if (!checkInProgress) {
      setCheckStatus("Idle", "idle");
    }
  });

  tokenPriceInput.addEventListener("input", updateCostSummary);
  tokenPriceInput.addEventListener("change", updateCostSummary);
  documentTitleInput.addEventListener("input", () => {
    document.title = `${documentTitleInput.value.trim() || "Untitled document"} — ClearKey`;
    saveDocument();
  });

  documentsNav.addEventListener("click", () => setView("documents"));
  settingsNav.addEventListener("click", () => setView("settings"));
  brandHome.addEventListener("click", (event) => {
    event.preventDefault();
    setView("editor");
  });
  newDocumentButton.addEventListener("click", createNewDocument);
  emptyNewDocumentButton.addEventListener("click", createNewDocument);
  documentsGrid.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const deleteButton = target && target.closest("[data-delete-document]");
    if (deleteButton) {
      event.stopPropagation();
      deleteDocument(deleteButton.dataset.deleteDocument);
      return;
    }
    const card = target && target.closest("[data-document-id]");
    if (card) {
      openDocument(card.dataset.documentId);
    }
  });
  documentsGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const card = target && target.closest("[data-document-id]");
    if (card && target === card) {
      event.preventDefault();
      openDocument(card.dataset.documentId);
    }
  });

  setupCloseButton.addEventListener("click", () => setupModal.close());
  setupSkipButton.addEventListener("click", () => setupModal.close());
  setupModal.addEventListener("close", persistSetupDismissal);
  setupModal.addEventListener("click", (event) => {
    if (event.target === setupModal) {
      setupModal.close();
    }
  });

  setupNextButton.addEventListener("click", () => {
    if (currentSetupStep === 1) {
      if (!setupBaseUrlInput.value.trim()) {
        setSetupTestStatus("Paste a Base URL to continue.", "error");
        showToast("Paste a Base URL to continue.", "error");
        setupBaseUrlInput.focus();
        return;
      }
      setSetupTestStatus("", "");
      showSetupStep(2);
      setupModelNameInput.focus();
      return;
    }

    if (!setupModelNameInput.value.trim()) {
      setSetupTestStatus("Paste a model name to continue.", "error");
      showToast("Paste a model name to continue.", "error");
      setupModelNameInput.focus();
      return;
    }
    setSetupTestStatus("", "");
    showSetupStep(3);
    setupApiKeyInput.focus();
  });

  setupBackButton.addEventListener("click", () => {
    showSetupStep(currentSetupStep - 1);
    (currentSetupStep === 1 ? setupBaseUrlInput : setupModelNameInput).focus();
  });

  setupFinishButton.addEventListener("click", () => setupModal.close());
  setupTestButton.addEventListener("click", () => {
    saveSettings();
    testApiKey(setupTestButton);
  });

  trySampleButton.addEventListener("click", () => {
    if (getEditorText().trim() && !window.confirm("Replace your current text with the sample paragraph?")) {
      return;
    }

    const sampleText = "Yesterday, the team have finish the report and we was happy with it's results. Their going to share it tomorrow however nobody know what the numbers means.";
    editor.textContent = sampleText;
    resetSuggestions();
    updateCounts();
    saveDocument();
    editor.focus();
    setCaretAtTextOffset(sampleText.length);
    scheduleAutoCheck();
    showToast(
      apiKeyInput.value.trim()
        ? "Sample text loaded. Check it whenever you’re ready."
        : "Sample text loaded. Add your API key to enable checking.",
      "success"
    );
  });

  loadSettings();
  loadDocuments();
  syncSetupFields();
  const providerPreset = Array.from(document.querySelectorAll("[data-provider-url]"))
    .find((button) => button.dataset.providerUrl && button.dataset.providerUrl === baseUrlInput.value);
  const customPreset = document.querySelector('[data-provider-url=""]');
  document.querySelectorAll("[data-provider-url]").forEach((button) => {
    button.classList.toggle("is-selected", button === (providerPreset || customPreset));
  });
  updateCostSummary();
  maybeOpenSetupModal();

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
      const text = getEditorText();
      localStorage.setItem(storageKey, text);
      updateActiveDocumentRecord(text);
      document.title = `${documentTitleInput.value.trim() || "Untitled document"} — ClearKey`;
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
      showToast("Write something before copying.", "error");
      return;
    }

    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API is unavailable");
      }
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard");
      showToast("Copied to clipboard.", "success");
    } catch (clipboardError) {
      try {
        if (copyWithFallback(text)) {
          setStatus("Copied to clipboard");
          showToast("Copied to clipboard.", "success");
          return;
        }
      } catch (fallbackError) {
        console.error("ClearKey clipboard fallback failed.", fallbackError);
      }
      setStatus("Copy failed — allow clipboard access");
      console.error("ClearKey could not copy the document to the clipboard.", clipboardError);
      showToast("Copy failed. Allow clipboard access and try again.", "error");
    }
  }

  editor.addEventListener("input", () => {
    updateCounts();
    resetSuggestions();
    setStatus("Unsaved changes");
    if (!checkInProgress) {
      setCheckStatus("Idle", "idle");
    }
    scheduleAutoCheck();
  });

  editor.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const highlight = target && target.closest(".suggestion-highlight");
    if (highlight) {
      openSuggestionPopup(highlight);
    }
  });

  suggestionPopup.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target && target.closest("[data-popup-action]");
    if (!button) {
      return;
    }
    if (button.dataset.popupAction === "dismiss") {
      closeSuggestionPopup();
    } else if (button.dataset.popupAction === "apply") {
      applySuggestion(button.dataset.suggestionKey);
    } else if (button.dataset.popupAction === "ignore") {
      ignoreSuggestion(button.dataset.suggestionKey);
    }
  });

  suggestionBulkActions.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target && target.closest("button");
    if (!button) {
      return;
    }
    if (button.classList.contains("apply-all-button")) {
      applyAllSuggestions();
    } else if (button.classList.contains("ignore-all-button")) {
      ignoreAllSuggestions();
    }
  });

  suggestionsList.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target && target.closest("[data-suggestion-action]");
    if (!button) {
      return;
    }
    if (button.dataset.suggestionAction === "apply") {
      applySuggestion(button.dataset.suggestionKey);
    } else if (button.dataset.suggestionAction === "ignore") {
      ignoreSuggestion(button.dataset.suggestionKey);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      !suggestionPopup.hidden
      && !suggestionPopup.contains(target)
      && !(target && target.closest(".suggestion-highlight"))
    ) {
      closeSuggestionPopup();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !suggestionPopup.hidden) {
      closeSuggestionPopup();
    }
  });

  window.addEventListener("resize", positionSuggestionPopup);
  window.addEventListener("scroll", positionSuggestionPopup, true);

  editor.addEventListener("paste", (event) => {
    if (!event.clipboardData) {
      return;
    }
    event.preventDefault();
    insertPlainText(event.clipboardData.getData("text/plain"));
  });

  copyButton.addEventListener("click", copyDocument);

  clearButton.addEventListener("click", () => {
    if (getEditorText().trim() && !window.confirm("Clear all text in this document?")) {
      return;
    }
    editor.replaceChildren();
    resetSuggestions();
    updateCounts();
    scheduleAutoCheck();
    setStatus("Document cleared");
    saveDocument();
    editor.focus();
    showToast("Document cleared.", "success");
  });

  try {
    const savedDocument = localStorage.getItem(storageKey);
    const activeRecord = documents.find((item) => item.id === activeDocumentId);
    if (savedDocument !== null) {
      editor.textContent = savedDocument;
      if (activeRecord) {
        documentTitleInput.value = activeRecord.title || "Untitled document";
      } else if (savedDocument.trim()) {
        activeDocumentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        documentTitleInput.value = "Untitled document";
      }
      setStatus("Document restored");
    } else if (activeRecord) {
      editor.textContent = activeRecord.content;
      documentTitleInput.value = activeRecord.title || "Untitled document";
      setStatus("Document restored");
    }
  } catch (error) {
    reportStorageError("restore", error);
  }

  updateCounts();
  if (activeDocumentId && !documents.some((item) => item.id === activeDocumentId)) {
    activeDocumentId = null;
  }
  if (activeDocumentId) {
    updateActiveDocumentRecord(getEditorText());
  }
  window.setInterval(saveDocument, 2000);
  window.addEventListener("pagehide", saveDocument);
})();
