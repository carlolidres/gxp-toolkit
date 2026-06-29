(function () {
  if (window.__workflowInspectorLoaded) return;
  window.__workflowInspectorLoaded = true;

  var inspecting = false;
  var highlight = null;
  var badge = null;
  var consoleErrors = [];
  var networkErrors = [];
  var MAX_DIAGNOSTICS = 10;

  function previewUrl() {
    return window.__WORKFLOW_PREVIEW_URL__ || location.href;
  }

  function post(message) {
    message.source = "workflow-inspector";
    try {
      window.parent.postMessage(message, "*");
    } catch (error) {
      /* ignore cross-origin parent errors */
    }
  }

  function ensureOverlay() {
    if (highlight) return;
    highlight = document.createElement("div");
    highlight.style.cssText =
      "position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #1f6feb;" +
      "background:rgba(31,111,235,0.12);border-radius:3px;transition:all 40ms ease;display:none;";
    document.documentElement.appendChild(highlight);
    badge = document.createElement("div");
    badge.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;background:#1f6feb;color:#fff;" +
      "font:12px/1.4 Arial,sans-serif;padding:2px 6px;border-radius:3px;display:none;max-width:320px;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    document.documentElement.appendChild(badge);
  }

  function moveOverlay(element) {
    ensureOverlay();
    var rect = element.getBoundingClientRect();
    highlight.style.display = "block";
    highlight.style.left = rect.left + "px";
    highlight.style.top = rect.top + "px";
    highlight.style.width = rect.width + "px";
    highlight.style.height = rect.height + "px";
    badge.style.display = "block";
    badge.textContent = describeType(element) + " " + buildSelector(element);
    var top = rect.top - 22;
    badge.style.left = rect.left + "px";
    badge.style.top = (top < 0 ? rect.bottom + 4 : top) + "px";
  }

  function hideOverlay() {
    if (highlight) highlight.style.display = "none";
    if (badge) badge.style.display = "none";
  }

  function isStableId(id) {
    if (!id) return false;
    if (id.length > 40) return false;
    return !/[0-9]{4,}/.test(id) && !/^(react|radix|headlessui|mui)-/i.test(id);
  }

  function accessibleName(element) {
    var label = element.getAttribute("aria-label");
    if (label) return label.trim();
    var text = (element.textContent || "").trim();
    if (text) return text.slice(0, 60);
    var alt = element.getAttribute("alt");
    if (alt) return alt.trim();
    var placeholder = element.getAttribute("placeholder");
    if (placeholder) return placeholder.trim();
    return "";
  }

  function buildSelector(element) {
    var testId =
      element.getAttribute("data-testid") ||
      element.getAttribute("data-test") ||
      element.getAttribute("data-cy");
    if (testId) return '[data-testid="' + testId + '"]';
    if (isStableId(element.id)) return "#" + element.id;
    var role = element.getAttribute("role") || implicitRole(element);
    var name = accessibleName(element);
    if (role && name) return "role=" + role + '[name="' + name.slice(0, 40) + '"]';
    return cssPath(element);
  }

  function implicitRole(element) {
    var tag = element.tagName.toLowerCase();
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "nav") return "navigation";
    if (tag === "header") return "banner";
    if (tag === "main") return "main";
    if (tag === "input") {
      var type = (element.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "submit" || type === "button") return "button";
      return "textbox";
    }
    if (tag === "table") return "table";
    if (tag === "img") return "img";
    return "";
  }

  function cssPath(element) {
    var path = [];
    var node = element;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 4 && node !== document.body) {
      var part = node.tagName.toLowerCase();
      if (isStableId(node.id)) {
        path.unshift("#" + node.id);
        break;
      }
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (child) {
          return child.tagName === node.tagName;
        });
        if (siblings.length > 1) {
          part += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
        }
      }
      path.unshift(part);
      node = node.parentElement;
      depth += 1;
    }
    return path.join(" > ");
  }

  function describeType(element) {
    var tag = element.tagName.toLowerCase();
    if (tag === "input") return "input[" + (element.getAttribute("type") || "text") + "]";
    return tag;
  }

  function componentName(element) {
    var data =
      element.getAttribute("data-component") ||
      element.closest("[data-component]") &&
        element.closest("[data-component]").getAttribute("data-component");
    return data || "";
  }

  function parentContext(element) {
    var container = element.closest(
      "section,nav,header,footer,main,aside,form,[role],article,dialog"
    );
    if (!container || container === element) return "";
    var label =
      container.getAttribute("aria-label") ||
      container.getAttribute("role") ||
      container.tagName.toLowerCase();
    if (isStableId(container.id)) label += "#" + container.id;
    return label;
  }

  function collectContext(element) {
    var rect = element.getBoundingClientRect();
    var attributes = {};
    ["type", "name", "href", "placeholder", "aria-label", "role", "alt", "title"].forEach(function (attr) {
      var value = element.getAttribute(attr);
      if (value) attributes[attr] = value;
    });
    if (element.className && typeof element.className === "string") {
      attributes["class"] = element.className.trim().split(/\s+/).slice(0, 4).join(" ");
    }
    return {
      route: previewUrl(),
      element_type: describeType(element),
      visible_text: (element.innerText || element.textContent || "").trim().slice(0, 120),
      selector: buildSelector(element),
      attributes: attributes,
      component_name: componentName(element),
      parent_context: parentContext(element),
      dimensions:
        Math.round(rect.width) +
        "x" +
        Math.round(rect.height) +
        " @ (" +
        Math.round(rect.left) +
        "," +
        Math.round(rect.top) +
        ")",
    };
  }

  function diagnostics() {
    return {
      route: previewUrl(),
      user_agent: navigator.userAgent,
      viewport: window.innerWidth + "x" + window.innerHeight,
      timestamp: new Date().toISOString(),
      console_errors: consoleErrors.slice(-MAX_DIAGNOSTICS),
      network_errors: networkErrors.slice(-MAX_DIAGNOSTICS),
    };
  }

  function onMouseMove(event) {
    if (!inspecting) return;
    var element = event.target;
    if (!element || element === document.documentElement) return;
    moveOverlay(element);
  }

  function onClick(event) {
    if (!inspecting) return;
    event.preventDefault();
    event.stopPropagation();
    post({ type: "element", payload: collectContext(event.target) });
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && inspecting) {
      setInspecting(false);
      post({ type: "inspect-state", enabled: false });
    }
  }

  function setInspecting(value) {
    inspecting = value;
    if (!value) hideOverlay();
    document.documentElement.style.cursor = value ? "crosshair" : "";
  }

  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", hideOverlay, true);

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "workflow-app") return;
    if (data.action === "set-inspect") {
      setInspecting(!!data.enabled);
    } else if (data.action === "get-diagnostics") {
      post({ type: "diagnostics", payload: diagnostics() });
    }
  });

  window.addEventListener("error", function (event) {
    consoleErrors.push(
      (event.message || "Error") +
        (event.filename ? " @ " + event.filename + ":" + event.lineno : "")
    );
  });

  var nativeConsoleError = console.error;
  console.error = function () {
    try {
      consoleErrors.push(
        Array.prototype.map
          .call(arguments, function (item) {
            return typeof item === "string" ? item : JSON.stringify(item);
          })
          .join(" ")
          .slice(0, 300)
      );
    } catch (error) {
      /* ignore */
    }
    return nativeConsoleError.apply(console, arguments);
  };

  if (window.fetch) {
    var nativeFetch = window.fetch;
    window.fetch = function () {
      var url = arguments[0];
      return nativeFetch.apply(this, arguments).then(function (response) {
        if (!response.ok) {
          networkErrors.push(response.status + " " + (typeof url === "string" ? url : response.url));
        }
        return response;
      }).catch(function (error) {
        networkErrors.push("FAILED " + (typeof url === "string" ? url : "") + " " + error);
        throw error;
      });
    };
  }

  post({ type: "ready", payload: { route: previewUrl() } });
})();
