const state = {
  config: null,
  view: "dashboard",
  recordType: null,
  records: [],
  currentRecord: null,
  hasApprovedBaseline: false,
  feedbackElements: [],
  bugElements: [],
  lastSelectedElements: [],
  feedbackAttachments: [],
  bugAttachments: [],
  briefAttachments: [],
  briefAutosaveTimer: null,
  historyTab: "baselines",
  tasksTab: "open",
  lastDiagnostics: null,
  awaitingDiagnostics: false,
  inspecting: false,
  previewReady: false,
  aiOriginal: {},
  aiImproved: {},
  dirty: false,
};

const stageViews = new Set(["baseline", "planning", "execution", "review", "deployment", "maintenance"]);

const titleForView = {
  dashboard: "Dashboard",
  brief: "Project Brief",
  baseline: "Requirements & Baseline",
  planning: "Planning",
  execution: "Execution",
  review: "Review and Evaluation",
  deployment: "Deployment",
  maintenance: "Maintenance and Monitoring",
  feedback: "UI/UX Feedback",
  bug: "Debugging",
  tasks: "Generated Tasks",
  history: "Project History",
  settings: "Settings",
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showMessage(text, isError = false) {
  const node = document.getElementById("message");
  node.textContent = text;
  node.hidden = false;
  node.classList.toggle("error", !!isError);
  setTimeout(() => {
    node.hidden = true;
  }, 5000);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function submitter() {
  return document.getElementById("submitter").value.trim() || state.config.default_submitter;
}

function setView(view) {
  state.view = view;
  state.recordType = stageViews.has(view) ? view : null;
  document.querySelectorAll(".sidebar .nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.getElementById("viewTitle").textContent = titleForView[view] || view;
  document.querySelectorAll("main > .view").forEach((node) => {
    node.hidden = true;
  });
  if (stageViews.has(view)) {
    document.getElementById("stageView").hidden = false;
    loadStage(view);
  } else if (view === "brief") {
    document.getElementById("briefView").hidden = false;
    loadBrief();
  } else if (view === "feedback") {
    document.getElementById("feedbackView").hidden = false;
  } else if (view === "bug") {
    document.getElementById("bugView").hidden = false;
  } else if (view === "tasks") {
    document.getElementById("tasksView").hidden = false;
    loadTasksView();
  } else if (view === "history") {
    document.getElementById("historyView").hidden = false;
    loadHistory();
  } else if (view === "settings") {
    document.getElementById("settingsView").hidden = false;
    loadSettings();
  } else {
    document.getElementById("dashboardView").hidden = false;
    loadDashboard();
  }
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  state.hasApprovedBaseline = !!data.approved_baseline;
  const activity = (data.recent_activity || []).map((item) => `
    <div class="activity-item">
      <strong>${escapeHtml(item.label)}</strong>
      <span class="meta">${escapeHtml(item.detail)} · ${escapeHtml(item.created_at)}</span>
    </div>
  `).join("") || "<p class='meta'>No recent activity yet.</p>";
  document.getElementById("dashboardView").innerHTML = `
    <div class="dashboard-hero">
      <div>
        <h3>${escapeHtml(data.project_title)}</h3>
        <p class="meta">Recommended: ${escapeHtml(data.recommended_action)}</p>
      </div>
      <button type="button" class="continue-btn" id="continueWorkflow">Continue Workflow</button>
    </div>
    <div class="cards">
      <div class="card highlight"><span>Baseline</span><strong>${data.approved_baseline ? `#${data.approved_baseline.snapshot_number}` : "None"}</strong><small>${escapeHtml(data.baseline_status)}</small></div>
      <div class="card"><span>Brief status</span><strong>${escapeHtml(data.brief_status)}</strong></div>
      <div class="card"><span>UI/UX feedback</span><strong>${data.feedback_open}</strong></div>
      <div class="card"><span>Debugging</span><strong>${data.bugs_open}</strong></div>
      <div class="card"><span>Open tasks</span><strong>${data.handoff_open}</strong></div>
    </div>
    <h3 class="section-title">Recent activity</h3>
    <div class="activity-list">${activity}</div>
  `;
  document.getElementById("continueWorkflow").addEventListener("click", () => {
    setView(data.recommended_view || "brief");
  });
}

/* ---------- Project Brief ---------- */

function briefPayload() {
  return {
    title: document.getElementById("briefTitle").value.trim() || "Project Brief",
    description: document.getElementById("briefDescription").value.trim(),
    workflow_notes: document.getElementById("briefWorkflow").value.trim(),
    features_notes: document.getElementById("briefFeatures").value.trim(),
    additional_instructions: document.getElementById("briefInstructions").value.trim(),
    submitter: submitter(),
  };
}

function renderBriefAttachments(attachments) {
  const list = document.getElementById("briefAttachments");
  const items = attachments || state.briefAttachments;
  if (!items.length) {
    list.innerHTML = "<p class='meta'>No references attached yet.</p>";
    return;
  }
  list.innerHTML = items.map((item) => `
    <div class="file-item">
      <span>${escapeHtml(item.filename || item.file_path)}</span>
      ${item.annotation ? `<span class="meta">${escapeHtml(item.annotation)}</span>` : ""}
    </div>
  `).join("");
}

async function loadBrief() {
  const brief = await api("/api/brief");
  if (!brief || !brief.id) {
    renderBriefAttachments([]);
    return;
  }
  document.getElementById("briefTitle").value = brief.title || "";
  document.getElementById("briefDescription").value = brief.description || "";
  document.getElementById("briefWorkflow").value = brief.workflow_notes || "";
  document.getElementById("briefFeatures").value = brief.features_notes || "";
  document.getElementById("briefInstructions").value = brief.additional_instructions || "";
  state.briefAttachments = brief.attachments || [];
  renderBriefAttachments(state.briefAttachments);
  const structured = brief.structured || {};
  const wrap = document.getElementById("briefStructuredWrap");
  if (structured && Object.keys(structured).length) {
    wrap.hidden = false;
    document.getElementById("briefStructuredPreview").textContent = JSON.stringify(structured, null, 2);
  } else {
    wrap.hidden = true;
  }
}

function scheduleBriefSave() {
  state.dirty = true;
  clearTimeout(state.briefAutosaveTimer);
  state.briefAutosaveTimer = setTimeout(saveBriefDraft, 1500);
}

async function saveBriefDraft() {
  try {
    const brief = await api("/api/brief", {
      method: "POST",
      body: JSON.stringify(briefPayload()),
    });
    state.briefAttachments = brief.attachments || state.briefAttachments;
    renderBriefAttachments(state.briefAttachments);
    state.dirty = false;
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function structureBrief() {
  await saveBriefDraft();
  const status = document.getElementById("briefAiStatus");
  status.textContent = "Processing with AI...";
  try {
    const result = await api("/api/ai/structure-requirements", {
      method: "POST",
      body: JSON.stringify({ submitter: submitter() }),
    });
    if (result.status === "no_key") {
      status.textContent = result.message;
      return showMessage(result.message, true);
    }
    if (result.structured && Object.keys(result.structured).length) {
      document.getElementById("briefStructuredWrap").hidden = false;
      document.getElementById("briefStructuredPreview").textContent = JSON.stringify(result.structured, null, 2);
      status.textContent = "Requirements structured. Review open questions, then load into baseline.";
      showMessage("AI structured the brief. Review assumptions and open questions.");
    } else {
      status.textContent = result.message || "AI structuring failed.";
      showMessage(status.textContent, true);
    }
  } catch (error) {
    status.textContent = error.message;
    showMessage(error.message, true);
  }
}

async function loadBriefToBaseline(fromBaselineView = false) {
  await saveBriefDraft();
  try {
    const record = await api("/api/brief/apply-baseline", {
      method: "POST",
      body: JSON.stringify({ submitter: submitter() }),
    });
    showMessage("Requirements loaded into baseline draft.");
    if (fromBaselineView) {
      setView("baseline");
    } else {
      state.currentRecord = record;
      setView("baseline");
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function uploadBriefAttachment(file, note) {
  await saveBriefDraft();
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await api("/api/brief/attachments", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          data: reader.result,
          annotation: note,
          submitter: submitter(),
        }),
      });
      if (result.duplicate) showMessage("That file is already attached.");
      await loadBrief();
    } catch (error) {
      showMessage(error.message, true);
    }
  };
  reader.readAsDataURL(file);
}

/* ---------- Workflow stages ---------- */

const STAGE_STATUS_CLASS = {
  Draft: "badge-draft",
  Approved: "badge-approved",
  "For Review": "badge-review",
  "Needs Revision": "badge-warn",
  Rejected: "badge-warn",
};

function updateBaselineToolbar(recordType) {
  const isBaseline = recordType === "baseline";
  document.getElementById("loadFromBrief").hidden = !isBaseline;
  document.getElementById("saveBaseline").hidden = !isBaseline;
  document.getElementById("submitBaseline").hidden = !isBaseline;
  document.getElementById("changeSummaryWrap").hidden = !isBaseline;
  document.querySelectorAll(".legacy-action").forEach((node) => {
    node.hidden = isBaseline;
  });
  const submitBtn = document.getElementById("submitBaseline");
  submitBtn.textContent = state.hasApprovedBaseline ? "Submit Updated Baseline" : "Submit Baseline";
}

async function loadStage(recordType) {
  state.records = await api(`/api/records?type=${recordType}`);
  const dashboard = await api("/api/dashboard");
  state.hasApprovedBaseline = !!dashboard.approved_baseline;
  updateBaselineToolbar(recordType);
  const select = document.getElementById("recordSelect");
  select.innerHTML = state.records.map((record) => (
    `<option value="${record.id}">${escapeHtml(record.title)} (${record.status}, v${record.version_number})</option>`
  )).join("");
  if (state.records.length) {
    state.currentRecord = state.currentRecord && state.records.find((r) => r.id === state.currentRecord.id)
      ? state.currentRecord
      : state.records[0];
    select.value = state.currentRecord.id;
    state.currentRecord = state.records.find((r) => r.id === select.value);
  } else {
    state.currentRecord = null;
  }
  renderForm(recordType);
  renderStageBadge();
  renderStageHistory();
}

function renderStageBadge() {
  const badge = document.getElementById("stageBadge");
  const record = state.currentRecord;
  if (!record) {
    badge.textContent = "New draft";
    badge.className = "badge badge-draft";
    return;
  }
  badge.textContent = `${record.status} - v${record.version_number}`;
  badge.className = "badge " + (STAGE_STATUS_CLASS[record.status] || "badge-draft");
}

function renderForm(recordType) {
  const record = state.currentRecord;
  document.getElementById("recordTitle").value = record ? record.title : "";
  const payload = record ? record.payload : {};
  document.getElementById("dynamicFields").innerHTML = state.config.field_definitions[recordType].map((field) => `
    <label>
      ${escapeHtml(field)}
      <textarea data-field="${escapeHtml(field)}">${escapeHtml(payload[field] || "")}</textarea>
    </label>
  `).join("");
}

async function renderStageHistory() {
  const wrap = document.getElementById("stageHistory");
  if (!state.currentRecord) {
    wrap.innerHTML = "<p class='meta'>No saved versions yet.</p>";
    return;
  }
  const versions = await api(`/api/records/${state.currentRecord.id}/versions`);
  wrap.innerHTML = versions.map((version) => `
    <div class="list-item">
      <strong>Version ${version.version_number} - ${escapeHtml(version.status)}</strong>
      <p class="meta">${escapeHtml(version.submitter)} - ${escapeHtml(version.created_at)}</p>
    </div>
  `).join("");
}

function collectPayload() {
  const payload = {};
  document.querySelectorAll("#dynamicFields textarea").forEach((field) => {
    payload[field.dataset.field] = field.value.trim();
  });
  return payload;
}

async function saveRecord(event) {
  if (event) event.preventDefault();
  const body = {
    record_type: state.recordType,
    title: document.getElementById("recordTitle").value.trim() || "Untitled",
    payload: collectPayload(),
    submitter: submitter(),
    status: "Draft",
  };
  if (state.currentRecord) {
    state.currentRecord = await api(`/api/records/${state.currentRecord.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } else {
    state.currentRecord = await api("/api/records", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  state.dirty = false;
  showMessage("Draft saved.");
  await loadStage(state.recordType);
}

async function submitBaseline() {
  if (!state.currentRecord) {
    await saveRecord(null);
    if (!state.currentRecord) return showMessage("Create a baseline draft first.", true);
  } else {
    await saveRecord(null);
  }
  const summary = document.getElementById("changeSummary").value.trim();
  const isUpdate = state.hasApprovedBaseline;
  if (isUpdate && !summary) {
    return showMessage("Provide a summary of changes before submitting an updated baseline.", true);
  }
  const notes = summary || "Initial approved baseline.";
  state.currentRecord = await api(`/api/records/${state.currentRecord.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: "Approved", approver: submitter(), notes }),
  });
  state.hasApprovedBaseline = true;
  document.getElementById("changeSummary").value = "";
  showMessage(isUpdate ? "Updated baseline approved." : "Baseline submitted and approved.");
  await loadStage(state.recordType);
}

async function decide(decision) {
  if (!state.currentRecord) return showMessage("Select or create a record first.", true);
  state.currentRecord = await api(`/api/records/${state.currentRecord.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, approver: submitter(), notes: "" }),
  });
  showMessage(`${decision} recorded.`);
  await loadStage(state.recordType);
}

async function submitForReview() {
  if (!state.currentRecord) return showMessage("Select or create a record first.", true);
  state.currentRecord = await api(`/api/records/${state.currentRecord.id}/submit`, {
    method: "POST",
    body: JSON.stringify({ submitter: submitter() }),
  });
  showMessage("Submitted for review.");
  await loadStage(state.recordType);
}

/* ---------- Preview + inspector ---------- */

function previewFrame() {
  if (state.view === "bug") return document.getElementById("bugPreviewFrame");
  return document.getElementById("previewFrame");
}

function currentPreviewUrl() {
  if (state.view === "bug") {
    return document.getElementById("bugPreviewUrl").value.trim() || state.config.target_preview_url || "";
  }
  return document.getElementById("previewUrl").value.trim() || state.config.target_preview_url || "";
}

function loadPreview() {
  const url = currentPreviewUrl();
  if (!url) return showMessage("Set a target preview URL first (Settings).", true);
  state.previewReady = false;
  state.lastSelectedElements = [];
  const frame = previewFrame();
  if (!frame) return;
  frame.src = `/api/preview?url=${encodeURIComponent(url)}`;
  updatePreviewHint("Loading preview...");
}

function openPreviewTab() {
  const url = currentPreviewUrl();
  if (!url) return showMessage("Set a target preview URL first (Settings).", true);
  window.open(url, "_blank", "noopener");
}

function setInspectButton(enabled) {
  state.inspecting = enabled;
  const btn = state.view === "bug" ? document.getElementById("bugInspectToggle") : document.getElementById("inspectToggle");
  if (btn) {
    btn.textContent = `Inspect: ${enabled ? "On" : "Off"}`;
    btn.classList.toggle("active-toggle", enabled);
  }
}

function toggleInspect() {
  if (!state.previewReady) return showMessage("Load a preview before inspecting.", true);
  const enabled = !state.inspecting;
  setInspectButton(enabled);
  postToPreview({ action: "set-inspect", enabled });
}

function postToPreview(message) {
  const frame = previewFrame();
  if (!frame || !frame.contentWindow) return;
  message.source = "workflow-app";
  frame.contentWindow.postMessage(message, "*");
}

function updatePreviewHint(text) {
  const hint = document.getElementById("previewHint");
  if (!hint) return;
  if (text) {
    hint.textContent = text;
  } else if (state.previewReady) {
    hint.textContent = "Preview ready. Toggle Inspect, then click elements to add them to the composer.";
  } else {
    hint.textContent = "Set a target URL in Settings, then Load preview and toggle Inspect to select elements.";
  }
}

function onElementSelected(payload) {
  addElementTo(state.lastSelectedElements, payload);
  if (state.view === "bug") {
    addElementTo(state.bugElements, payload);
    renderElements("bugElements", state.bugElements);
    updateFinalPreview("bug");
  } else {
    addElementTo(state.feedbackElements, payload);
    renderElements("fbElements", state.feedbackElements);
    updateFinalPreview("feedback");
  }
  showMessage(`Added element: ${payload.element_type} ${payload.selector}`);
}

function addElementTo(list, payload) {
  if (list.some((item) => item.selector === payload.selector && item.route === payload.route)) return;
  list.push(payload);
}

function renderElements(containerId, list) {
  const container = document.getElementById(containerId);
  if (!list.length) {
    container.innerHTML = "<p class='meta'>No elements selected yet.</p>";
    return;
  }
  container.innerHTML = list.map((element, index) => `
    <div class="chip">
      <span class="chip-type">${escapeHtml(element.element_type)}</span>
      <code>${escapeHtml(element.selector)}</code>
      ${element.visible_text ? `<span class="chip-text">"${escapeHtml(element.visible_text.slice(0, 40))}"</span>` : ""}
      <button type="button" data-remove-element="${containerId}:${index}">x</button>
    </div>
  `).join("");
}

function removeElement(containerId, index) {
  const list = containerId === "bugElements" ? state.bugElements : state.feedbackElements;
  list.splice(index, 1);
  renderElements(containerId, list);
  updateFinalPreview(containerId === "bugElements" ? "bug" : "feedback");
}

function stageScreenshot(inputId, noteId, listId, store, view) {
  const input = document.getElementById(inputId);
  const note = document.getElementById(noteId);
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    store.push({ filename: file.name, data: reader.result, annotation: note.value.trim() });
    note.value = "";
    input.value = "";
    renderThumbs(listId, store, view);
    updateFinalPreview(view);
  };
  reader.readAsDataURL(file);
}

function renderThumbs(listId, store, view) {
  const list = document.getElementById(listId);
  if (!store.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = store.map((item, index) => `
    <div class="thumb">
      <img src="${item.data}" alt="${escapeHtml(item.filename)}">
      <span>${escapeHtml(item.annotation || item.filename)}</span>
      <button type="button" data-remove-thumb="${listId}:${index}">x</button>
    </div>
  `).join("");
}

function removeThumb(listId, index) {
  const store = listId === "bugAttachments" ? state.bugAttachments : state.feedbackAttachments;
  store.splice(index, 1);
  renderThumbs(listId, store, listId === "bugAttachments" ? "bug" : "feedback");
}

function composerOriginal(view) {
  if (view === "feedback") {
    const desc = document.getElementById("fbDescription").value.trim();
    const expected = document.getElementById("fbExpected").value.trim();
    const acceptance = document.getElementById("fbAcceptance").value.trim();
    return [desc, expected && `Expected: ${expected}`, acceptance && `Acceptance: ${acceptance}`]
      .filter(Boolean)
      .join("\n");
  }
  const parts = [
    document.getElementById("bugDescription").value.trim(),
    valueLine("bugSteps", "Steps"),
    valueLine("bugExpected", "Expected"),
    valueLine("bugActual", "Actual"),
    valueLine("bugConsole", "Console"),
    valueLine("bugNetwork", "Network"),
  ];
  return parts.filter(Boolean).join("\n");
}

function valueLine(id, label) {
  const value = document.getElementById(id).value.trim();
  return value ? `${label}: ${value}` : "";
}

function composerContext(view) {
  if (view === "feedback") {
    return {
      category: document.getElementById("fbCategory").value,
      priority: document.getElementById("fbPriority").value,
      source_page: currentPreviewUrl(),
      elements: state.feedbackElements.map(compactElement),
    };
  }
  return {
    route: document.getElementById("bugRoute").value,
    severity: document.getElementById("bugSeverity").value,
    environment: document.getElementById("bugEnv").value,
    elements: state.bugElements.map(compactElement),
  };
}

function compactElement(element) {
  return {
    type: element.element_type,
    selector: element.selector,
    text: element.visible_text,
    component: element.component_name,
    context: element.parent_context,
  };
}

function aiStatusMessage(result) {
  const messages = {
    ok: "AI improved the instruction.",
    no_key: result.message || "No API key. Using original input.",
    invalid_key: result.message || "Invalid API key. Using original input.",
    rate_limited: result.message || "Rate limited. Using original input.",
    error: result.message || "AI unavailable. Using original input.",
    empty: result.message || "Provide input first.",
  };
  return messages[result.status] || "Using original input.";
}

async function aiImprove(block) {
  const view = block.dataset.ai;
  const improvedEl = block.querySelector("[data-ai-improved]");
  const statusEl = block.querySelector("[data-ai-status]");
  const text = composerOriginal(view);
  if (!text.trim()) {
    statusEl.textContent = "Add a description before improving.";
    return;
  }
  state.aiOriginal[view] = text;
  statusEl.textContent = "Improving with AI...";
  block.classList.add("loading");
  try {
    const result = await api("/api/ai/improve", {
      method: "POST",
      body: JSON.stringify({ phase: view, kind: view, text, context: composerContext(view) }),
    });
    state.aiImproved[view] = result.compact_instruction || result.improved || text;
    improvedEl.value = state.aiImproved[view];
    if (result.acceptance_criteria) {
      const acceptance = document.getElementById(view === "feedback" ? "fbAcceptance" : "bugExpected");
      if (acceptance && !acceptance.value.trim()) acceptance.value = result.acceptance_criteria;
    }
    statusEl.textContent = aiStatusMessage(result);
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    block.classList.remove("loading");
    updateFinalPreview(view);
  }
}

function aiAction(block, action) {
  const view = block.dataset.ai;
  const improvedEl = block.querySelector("[data-ai-improved]");
  const statusEl = block.querySelector("[data-ai-status]");
  const compareEl = block.querySelector("[data-ai-compare]");
  if (action === "improve") return aiImprove(block);
  if (action === "original") {
    improvedEl.value = "";
    statusEl.textContent = "Using your original input on submit.";
  } else if (action === "accept") {
    statusEl.textContent = "Accepted improved version.";
  } else if (action === "restore") {
    improvedEl.value = state.aiOriginal[view] || composerOriginal(view);
    statusEl.textContent = "Restored original text.";
  } else if (action === "compare") {
    const original = state.aiOriginal[view] || composerOriginal(view);
    const improved = improvedEl.value || "(empty)";
    compareEl.hidden = !compareEl.hidden;
    compareEl.innerHTML = `
      <div class="compare-col"><strong>Original</strong><pre>${escapeHtml(original)}</pre></div>
      <div class="compare-col"><strong>Improved</strong><pre>${escapeHtml(improved)}</pre></div>
    `;
  }
  updateFinalPreview(view);
}

function updateFinalPreview(view) {
  const targetId = view === "bug" ? "bugFinalPreview" : "fbFinalPreview";
  const node = document.getElementById(targetId);
  if (!node) return;
  if (view === "feedback") {
    node.innerHTML = finalSection("Selected UI context", elementsSummary(state.feedbackElements))
      + finalSection("User comments", document.getElementById("fbDescription").value)
      + finalSection("Screenshots", attachmentSummary(state.feedbackAttachments))
      + finalSection("Expected result", document.getElementById("fbExpected").value)
      + finalSection("Acceptance criteria", document.getElementById("fbAcceptance").value)
      + finalSection("AI task", currentImproved("feedback"));
  } else {
    node.innerHTML = finalSection("Affected elements", elementsSummary(state.bugElements))
      + finalSection("Description", document.getElementById("bugDescription").value)
      + finalSection("Steps to reproduce", document.getElementById("bugSteps").value)
      + finalSection("Expected vs actual", `${document.getElementById("bugExpected").value} / ${document.getElementById("bugActual").value}`)
      + finalSection("Environment", document.getElementById("bugEnv").value)
      + finalSection("Console / network", `${document.getElementById("bugConsole").value} | ${document.getElementById("bugNetwork").value}`)
      + finalSection("Screenshots", attachmentSummary(state.bugAttachments))
      + finalSection("AI debug task", currentImproved("bug"));
  }
}

function currentImproved(view) {
  const block = document.querySelector(`.ai-block[data-ai="${view}"] [data-ai-improved]`);
  return block ? block.value : "";
}

function finalSection(title, body) {
  return `<div class="final-section"><strong>${escapeHtml(title)}</strong><div>${escapeHtml(body || "(empty)")}</div></div>`;
}

function elementsSummary(list) {
  if (!list.length) return "(none)";
  return list.map((element) => `${element.element_type} [${element.selector}]`).join("; ");
}

function attachmentSummary(store) {
  if (!store.length) return "(none)";
  return store.map((item) => item.annotation || item.filename).join("; ");
}

async function uploadAttachments(entryId, store) {
  for (const item of store) {
    await api(`/api/handoff/${entryId}/attachments`, {
      method: "POST",
      body: JSON.stringify({
        filename: item.filename,
        data: item.data,
        annotation: item.annotation,
        submitter: submitter(),
      }),
    });
  }
}

async function submitFeedback(event) {
  event.preventDefault();
  const title = document.getElementById("fbTitle").value.trim();
  const description = document.getElementById("fbDescription").value.trim();
  if (!title || !description) return showMessage("Title and a description are required.", true);
  if (!state.feedbackElements.length && !state.feedbackAttachments.length
      && !document.getElementById("fbExpected").value.trim()) {
    return showMessage("Add a selected element, screenshot, or expected result for enough context.", true);
  }
  const improved = currentImproved("feedback").trim();
  const payload = {
    description,
    expected_result: document.getElementById("fbExpected").value.trim(),
    acceptance_criteria: document.getElementById("fbAcceptance").value.trim(),
  };
  try {
    const entry = await api("/api/handoff", {
      method: "POST",
      body: JSON.stringify({
        phase: "feedback",
        title,
        payload,
        original_text: description,
        ai_instruction: improved,
        compact_instruction: improved || description,
        category: document.getElementById("fbCategory").value,
        priority: document.getElementById("fbPriority").value,
        source_page: currentPreviewUrl(),
        elements: state.feedbackElements.map(toElementRecord),
        submitter: submitter(),
      }),
    });
    await uploadAttachments(entry.id, state.feedbackAttachments);
    showMessage(`Feedback submitted as ${entry.reference_id}.`);
    resetFeedback();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function submitBug(event) {
  event.preventDefault();
  const title = document.getElementById("bugTitle").value.trim();
  const description = document.getElementById("bugDescription").value.trim();
  if (!title || !description) return showMessage("Bug title and description are required.", true);
  const improved = currentImproved("bug").trim();
  const payload = {
    description,
    route: document.getElementById("bugRoute").value.trim(),
    steps: document.getElementById("bugSteps").value.trim(),
    expected_result: document.getElementById("bugExpected").value.trim(),
    actual_result: document.getElementById("bugActual").value.trim(),
    environment: document.getElementById("bugEnv").value.trim(),
    console_error: document.getElementById("bugConsole").value.trim(),
    network_error: document.getElementById("bugNetwork").value.trim(),
    acceptance_criteria: "Bug no longer reproducible with the steps above; expected result observed.",
  };
  try {
    const entry = await api("/api/handoff", {
      method: "POST",
      body: JSON.stringify({
        phase: "bug",
        title,
        payload,
        original_text: description,
        ai_instruction: improved,
        compact_instruction: improved || description,
        category: "Bug",
        priority: document.getElementById("bugPriority").value,
        source_page: document.getElementById("bugRoute").value.trim(),
        elements: state.bugElements.map(toElementRecord),
        submitter: submitter(),
      }),
    });
    await uploadAttachments(entry.id, state.bugAttachments);
    showMessage(`Debug report submitted as ${entry.reference_id}.`);
    resetBug();
  } catch (error) {
    showMessage(error.message, true);
  }
}

function toElementRecord(element) {
  return {
    route: element.route,
    element_type: element.element_type,
    visible_text: element.visible_text,
    selector: element.selector,
    attributes: element.attributes,
    component_name: element.component_name,
    parent_context: element.parent_context,
    dimensions: element.dimensions,
  };
}

function resetFeedback() {
  document.getElementById("feedbackForm").reset();
  state.feedbackElements = [];
  state.feedbackAttachments = [];
  state.aiImproved.feedback = "";
  renderElements("fbElements", state.feedbackElements);
  renderThumbs("fbAttachments", state.feedbackAttachments, "feedback");
  document.querySelector('.ai-block[data-ai="feedback"] [data-ai-improved]').value = "";
  populateComposerSelects();
  updateFinalPreview("feedback");
  state.dirty = false;
}

function resetBug() {
  document.getElementById("bugForm").reset();
  state.bugElements = [];
  state.bugAttachments = [];
  state.aiImproved.bug = "";
  renderElements("bugElements", state.bugElements);
  renderThumbs("bugAttachments", state.bugAttachments, "bug");
  document.querySelector('.ai-block[data-ai="bug"] [data-ai-improved]').value = "";
  populateComposerSelects();
  updateFinalPreview("bug");
  state.dirty = false;
}

function captureBugContext() {
  document.getElementById("bugRoute").value = currentPreviewUrl();
  state.lastSelectedElements.forEach((element) => addElementTo(state.bugElements, element));
  renderElements("bugElements", state.bugElements);
  if (state.previewReady) {
    state.awaitingDiagnostics = true;
    postToPreview({ action: "get-diagnostics" });
    showMessage("Requested environment, console, and network details from preview.");
  } else {
    document.getElementById("bugEnv").value = navigator.userAgent;
    showMessage("Preview not loaded; captured this browser's user agent.");
  }
  updateFinalPreview("bug");
}

function applyDiagnosticsToBug(diagnostics) {
  document.getElementById("bugEnv").value = `${diagnostics.user_agent} | viewport ${diagnostics.viewport}`;
  if (diagnostics.console_errors && diagnostics.console_errors.length) {
    document.getElementById("bugConsole").value = diagnostics.console_errors.join("\n");
  }
  if (diagnostics.network_errors && diagnostics.network_errors.length) {
    document.getElementById("bugNetwork").value = diagnostics.network_errors.join("\n");
  }
  if (!document.getElementById("bugRoute").value.trim()) {
    document.getElementById("bugRoute").value = diagnostics.route || "";
  }
  updateFinalPreview("bug");
}

/* ---------- Generated tasks ---------- */

function setTasksTab(tab) {
  state.tasksTab = tab;
  document.querySelectorAll("[data-tasks-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tasksTab === tab);
  });
  document.getElementById("queueList").hidden = tab !== "open";
  document.getElementById("submissionsList").hidden = tab !== "all";
  loadTasksView();
}

async function loadTasksView() {
  if (state.tasksTab === "all") {
    await loadSubmissions();
  } else {
    await loadQueue(true);
  }
}

async function loadQueue(openOnly = false) {
  const phase = document.getElementById("queuePhase").value;
  let status = document.getElementById("queueStatus").value;
  if (openOnly && !status) status = "";
  const params = new URLSearchParams();
  if (phase) params.set("phase", phase);
  if (status) params.set("status", status);
  let entries = await api(`/api/handoff?${params.toString()}`);
  if (openOnly && !status) {
    entries = entries.filter((entry) => !["completed", "rejected"].includes(entry.status));
  }
  const container = document.getElementById("queueList");
  if (!entries.length) {
    container.innerHTML = "<p class='empty-state'>No generated tasks yet.</p>";
    return;
  }
  container.innerHTML = entries.map((entry) => `
    <div class="list-item queue-item">
      <div class="queue-head">
        <strong>${escapeHtml(entry.reference_id)} - ${escapeHtml(entry.title)}</strong>
        <span class="badge ${statusBadgeClass(entry.status)}">${escapeHtml(entry.status)}</span>
      </div>
      <p class="meta">${escapeHtml(state.config.handoff_phases[entry.phase] || entry.phase)} - ${escapeHtml(entry.priority)} - ${escapeHtml(entry.created_at)}</p>
      <p>${escapeHtml((entry.compact_instruction || entry.original_text || "").slice(0, 220))}</p>
      <div class="queue-actions">
        <button type="button" data-export-task="${entry.id}">Export task file</button>
        ${state.config.handoff_statuses.map((itemStatus) => `
          <button type="button" data-queue-status="${entry.id}:${itemStatus}" ${itemStatus === entry.status ? "disabled" : ""}>${escapeHtml(itemStatus)}</button>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function statusBadgeClass(status) {
  if (status === "completed") return "badge-approved";
  if (status === "rejected") return "badge-warn";
  if (status === "in_progress") return "badge-review";
  if (status === "needs_clarification") return "badge-warn";
  return "badge-draft";
}

async function updateQueueStatus(entryId, status) {
  await api(`/api/handoff/${entryId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, actor: submitter() }),
  });
  showMessage(`Status updated to ${status}.`);
  loadTasksView();
}

async function exportTask(entryId) {
  const result = await api(`/api/handoff/${entryId}/export`, {
    method: "POST",
    body: JSON.stringify({ submitter: submitter() }),
  });
  showMessage(`Exported ${result.reference_id} to ${result.path}`);
}

async function loadSubmissions() {
  const entries = await api("/api/handoff");
  const container = document.getElementById("submissionsList");
  if (!entries.length) {
    container.innerHTML = "<p class='empty-state'>No submissions yet.</p>";
    return;
  }
  container.innerHTML = entries.map((entry) => `
    <div class="list-item">
      <strong>${escapeHtml(entry.reference_id)} - ${escapeHtml(entry.title)}</strong>
      <p class="meta">${escapeHtml(state.config.handoff_phases[entry.phase] || entry.phase)} - ${escapeHtml(entry.status)} - ${escapeHtml(entry.priority)} - ${escapeHtml(entry.submitter)} - ${escapeHtml(entry.created_at)}</p>
      <button type="button" data-export-task="${entry.id}">Export task file</button>
    </div>
  `).join("");
}

/* ---------- Project history ---------- */

function setHistoryTab(tab) {
  state.historyTab = tab;
  document.querySelectorAll("[data-history-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.historyTab === tab);
  });
  document.getElementById("historyPanelBaselines").hidden = tab !== "baselines";
  document.getElementById("historyPanelRecords").hidden = tab !== "records";
  document.getElementById("historyPanelComments").hidden = tab !== "comments";
  document.getElementById("historyPanelAudit").hidden = tab !== "audit";
  document.getElementById("historyPanelLegacy").hidden = tab !== "legacy";
  if (tab === "comments") loadComments();
  if (tab === "audit") loadAudit();
}

async function allRecords() {
  return api("/api/records");
}

function recordOptions(records) {
  return records.map((record) => (
    `<option value="${record.id}">${escapeHtml(record.title)} - ${titleForView[record.record_type] || record.record_type} (${record.status})</option>`
  )).join("");
}

async function loadComments() {
  const records = await allRecords();
  document.getElementById("commentRecord").innerHTML = recordOptions(records);
  const comments = await api("/api/comments");
  document.getElementById("commentsList").innerHTML = comments.map((comment) => `
    <div class="list-item">
      <strong>${escapeHtml(comment.comment_type)}</strong>
      <p>${escapeHtml(comment.body)}</p>
      <p class="meta">${escapeHtml(comment.author)} - ${escapeHtml(comment.created_at)}</p>
    </div>
  `).join("") || "<p class='empty-state'>No comments yet.</p>";
}

async function addComment(event) {
  event.preventDefault();
  const recordId = document.getElementById("commentRecord").value;
  if (!recordId) return showMessage("Create a record before adding comments.", true);
  await api("/api/comments", {
    method: "POST",
    body: JSON.stringify({
      record_id: recordId,
      author: submitter(),
      comment_type: document.getElementById("commentType").value,
      body: document.getElementById("commentBody").value.trim(),
    }),
  });
  document.getElementById("commentBody").value = "";
  showMessage("Comment recorded.");
  loadComments();
}

async function loadHistory() {
  setHistoryTab(state.historyTab);
  const records = await allRecords();
  document.getElementById("historyRecord").innerHTML = recordOptions(records);
  await renderHistory();
  const snapshots = await api("/api/baselines");
  document.getElementById("baselineSnapshots").innerHTML = snapshots.map((snapshot) => `
    <div class="list-item">
      <strong>Version #${snapshot.snapshot_number}${snapshot.is_active ? " (current)" : " (superseded)"}</strong>
      <p class="meta">${escapeHtml(snapshot.created_at)}${snapshot.change_summary ? ` · ${escapeHtml(snapshot.change_summary)}` : ""}</p>
      <button type="button" data-restore="${snapshot.id}">Restore baseline</button>
    </div>
  `).join("") || "<p class='empty-state'>No approved baselines yet.</p>";
}

async function renderHistory() {
  const recordId = document.getElementById("historyRecord").value;
  if (!recordId) {
    document.getElementById("historyList").innerHTML = "<p class='empty-state'>No records yet.</p>";
    return;
  }
  const versions = await api(`/api/records/${recordId}/versions`);
  document.getElementById("historyList").innerHTML = versions.map((version) => `
    <div class="list-item">
      <strong>Version ${version.version_number} - ${escapeHtml(version.status)}</strong>
      <p class="meta">${escapeHtml(version.submitter)} - ${escapeHtml(version.created_at)}</p>
      <pre>${escapeHtml(JSON.stringify(version.payload, null, 2))}</pre>
    </div>
  `).join("");
}

async function loadAudit() {
  const events = await api("/api/audit");
  document.getElementById("auditList").innerHTML = events.map((event) => `
    <div class="list-item">
      <strong>${escapeHtml(event.event_type)}</strong>
      <p class="meta">${escapeHtml(event.actor)} - ${escapeHtml(event.created_at)}</p>
      <pre>${escapeHtml(JSON.stringify(event.details, null, 2))}</pre>
    </div>
  `).join("") || "<p class='empty-state'>No audit events yet.</p>";
}

async function loadSettings() {
  const settings = await api("/api/settings");
  document.getElementById("setTargetUrl").value = settings.target_preview_url || "";
  document.getElementById("setModel").value = settings.openai_model || "";
  document.getElementById("setBaseUrl").value = settings.openai_base_url || "";
  document.getElementById("setSubmitter").value = settings.default_submitter || "";
  document.getElementById("aiStatus").textContent = settings.ai_available
    ? "OpenAI API key detected. AI features are available."
    : "No OpenAI API key detected. Manual input still works.";
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify({
      target_preview_url: document.getElementById("setTargetUrl").value.trim(),
      openai_model: document.getElementById("setModel").value.trim(),
      openai_base_url: document.getElementById("setBaseUrl").value.trim(),
      default_submitter: document.getElementById("setSubmitter").value.trim(),
    }),
  });
  state.config.target_preview_url = settings.target_preview_url;
  document.getElementById("previewUrl").value = settings.target_preview_url || "";
  document.getElementById("bugPreviewUrl").value = settings.target_preview_url || "";
  showMessage("Settings saved.");
}

function fillSelect(id, values) {
  document.getElementById(id).innerHTML = values.map((value) => `<option>${escapeHtml(value)}</option>`).join("");
}

function populateComposerSelects() {
  fillSelect("fbCategory", state.config.feedback_categories);
  fillSelect("fbPriority", state.config.priorities);
  fillSelect("bugSeverity", state.config.priorities);
  fillSelect("bugPriority", state.config.priorities);
  document.getElementById("fbPriority").value = "Medium";
  document.getElementById("bugPriority").value = "Medium";
  document.getElementById("bugSeverity").value = "Medium";
}

async function init() {
  state.config = await api("/api/config");
  document.getElementById("submitter").value = state.config.default_submitter;
  document.getElementById("previewUrl").value = state.config.target_preview_url || "";
  document.getElementById("bugPreviewUrl").value = state.config.target_preview_url || "";

  document.getElementById("queueStatus").innerHTML = `<option value="">All statuses</option>`
    + state.config.handoff_statuses.map((status) => `<option value="${status}">${status}</option>`).join("");
  populateComposerSelects();
  renderElements("fbElements", state.feedbackElements);
  renderElements("bugElements", state.bugElements);

  document.querySelectorAll(".sidebar .nav").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll(".legacy-nav [data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll("[data-history-tab]").forEach((button) => {
    button.addEventListener("click", () => setHistoryTab(button.dataset.historyTab));
  });
  document.querySelectorAll("[data-tasks-tab]").forEach((button) => {
    button.addEventListener("click", () => setTasksTab(button.dataset.tasksTab));
  });

  ["briefTitle", "briefDescription", "briefWorkflow", "briefFeatures", "briefInstructions"].forEach((id) => {
    document.getElementById(id).addEventListener("input", scheduleBriefSave);
  });
  document.getElementById("structureBrief").addEventListener("click", structureBrief);
  document.getElementById("loadBriefBaseline").addEventListener("click", () => loadBriefToBaseline(false));
  document.getElementById("loadFromBrief").addEventListener("click", () => loadBriefToBaseline(true));
  document.getElementById("briefAttachment").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    uploadBriefAttachment(file, document.getElementById("briefAttachmentNote").value.trim());
    event.target.value = "";
    document.getElementById("briefAttachmentNote").value = "";
  });

  document.getElementById("recordSelect").addEventListener("change", (event) => {
    state.currentRecord = state.records.find((record) => record.id === event.target.value);
    renderForm(state.recordType);
    renderStageBadge();
    renderStageHistory();
  });
  document.getElementById("newRecord").addEventListener("click", () => {
    state.currentRecord = null;
    renderForm(state.recordType);
    renderStageBadge();
    renderStageHistory();
  });
  document.getElementById("recordForm").addEventListener("submit", saveRecord);
  document.getElementById("recordForm").addEventListener("input", () => { state.dirty = true; });
  document.getElementById("saveBaseline").addEventListener("click", () => saveRecord(null));
  document.getElementById("submitBaseline").addEventListener("click", submitBaseline);
  document.getElementById("submitReview").addEventListener("click", submitForReview);
  document.getElementById("approveRecord").addEventListener("click", () => decide("Approved"));
  document.getElementById("needsRevision").addEventListener("click", () => decide("Needs Revision"));
  document.getElementById("rejectRecord").addEventListener("click", () => decide("Rejected"));
  document.getElementById("completeRecord").addEventListener("click", () => decide("Completed"));
  document.getElementById("deployRecord").addEventListener("click", () => decide("Deployed"));

  document.getElementById("loadPreview").addEventListener("click", loadPreview);
  document.getElementById("openPreview").addEventListener("click", openPreviewTab);
  document.getElementById("inspectToggle").addEventListener("click", toggleInspect);
  document.getElementById("bugLoadPreview").addEventListener("click", loadPreview);
  document.getElementById("bugInspectToggle").addEventListener("click", toggleInspect);
  document.getElementById("viewport").addEventListener("change", (event) => {
    const frame = previewFrame();
    if (frame) frame.style.maxWidth = event.target.value;
  });

  document.getElementById("feedbackForm").addEventListener("submit", submitFeedback);
  document.getElementById("feedbackForm").addEventListener("input", () => {
    state.dirty = true;
    updateFinalPreview("feedback");
  });
  document.getElementById("clearElements").addEventListener("click", () => {
    state.feedbackElements = [];
    renderElements("fbElements", state.feedbackElements);
    updateFinalPreview("feedback");
  });
  document.getElementById("fbScreenshot").addEventListener("change", () =>
    stageScreenshot("fbScreenshot", "fbScreenshotNote", "fbAttachments", state.feedbackAttachments, "feedback"));

  document.getElementById("bugForm").addEventListener("submit", submitBug);
  document.getElementById("bugForm").addEventListener("input", () => {
    state.dirty = true;
    updateFinalPreview("bug");
  });
  document.getElementById("bugCapture").addEventListener("click", captureBugContext);
  document.getElementById("bugClearElements").addEventListener("click", () => {
    state.bugElements = [];
    renderElements("bugElements", state.bugElements);
    updateFinalPreview("bug");
  });
  document.getElementById("bugScreenshot").addEventListener("change", () =>
    stageScreenshot("bugScreenshot", "bugScreenshotNote", "bugAttachments", state.bugAttachments, "bug"));

  document.querySelectorAll(".ai-block [data-ai-action]").forEach((button) => {
    button.addEventListener("click", () => aiAction(button.closest(".ai-block"), button.dataset.aiAction));
  });

  document.getElementById("queuePhase").addEventListener("change", loadTasksView);
  document.getElementById("queueStatus").addEventListener("change", loadTasksView);
  document.getElementById("refreshQueue").addEventListener("click", loadTasksView);

  document.getElementById("commentForm").addEventListener("submit", addComment);
  document.getElementById("refreshHistory").addEventListener("click", renderHistory);
  document.getElementById("historyRecord").addEventListener("change", renderHistory);
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);

  document.body.addEventListener("click", (event) => {
    const removeElementTarget = event.target.getAttribute("data-remove-element");
    if (removeElementTarget) {
      const [containerId, index] = removeElementTarget.split(":");
      removeElement(containerId, Number(index));
    }
    const removeThumbTarget = event.target.getAttribute("data-remove-thumb");
    if (removeThumbTarget) {
      const [listId, index] = removeThumbTarget.split(":");
      removeThumb(listId, Number(index));
    }
    const queueStatusTarget = event.target.getAttribute("data-queue-status");
    if (queueStatusTarget) {
      const [entryId, status] = queueStatusTarget.split(":");
      updateQueueStatus(entryId, status);
    }
    const exportTarget = event.target.getAttribute("data-export-task");
    if (exportTarget) exportTask(exportTarget);
    const restoreTarget = event.target.getAttribute("data-restore");
    if (restoreTarget) {
      api(`/api/baselines/${restoreTarget}/restore`, {
        method: "POST",
        body: JSON.stringify({ actor: submitter() }),
      }).then(() => {
        showMessage("Baseline restored.");
        loadHistory();
      }).catch((error) => showMessage(error.message, true));
    }
  });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== "workflow-inspector") return;
    if (data.type === "ready") {
      state.previewReady = true;
      updatePreviewHint();
    } else if (data.type === "element") {
      onElementSelected(data.payload);
    } else if (data.type === "diagnostics") {
      state.lastDiagnostics = data.payload;
      if (state.awaitingDiagnostics) {
        applyDiagnosticsToBug(data.payload);
        state.awaitingDiagnostics = false;
      }
    } else if (data.type === "inspect-state") {
      setInspectButton(data.enabled);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  setView("dashboard");
}

init().catch((error) => showMessage(error.message, true));
