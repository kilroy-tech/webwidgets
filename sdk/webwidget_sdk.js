const bootstrapParams = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

const WIDGET_CLOSING_EVENT = "WIDGET_CLOSING";
const FAYE_BROWSER_URL = "https://cdn.jsdelivr.net/npm/faye@1.4.0/client/faye-browser-min.min.js";

let fayeLoadPromise = null;

function initIframeFocusBridge(options = {}) {
    const enabled = options.enabled === true;
    const pdalias = String(options.pdalias || "").trim();
    const targetOrigin = String(options.targetOrigin || window.location.origin || "*");

    if (!enabled || !pdalias) {
        return function noopCleanup() {};
    }

    if (window.parent === window) {
        return function noopCleanup() {};
    }

    let lastSent = 0;
    const SEND_THROTTLE_MS = 120;

    function sendFocusIntent(reason) {
        const now = Date.now();
        if (now - lastSent < SEND_THROTTLE_MS) return;
        lastSent = now;

        try {
            window.parent.postMessage(
                {
                    _cmd: "focus_widget_window",
                    pdalias,
                    reason: reason || "",
                    ts: now,
                },
                targetOrigin
            );
        }
        catch (_err) {
            // ignore postMessage failures
        }
    }

    const onPointerDown = () => sendFocusIntent("pointerdown");
    const onFocusIn = () => sendFocusIntent("focusin");

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);

    return function cleanupIframeFocusBridge() {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("focusin", onFocusIn, true);
    };
}

function parseJson(value, fallback = null) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch (_err) {
        return fallback;
    }
}

function appendQueryParams(rawUrl, params) {
    const urlText = (rawUrl || "about:blank").toString();
    if (!urlText || urlText === "about:blank") return urlText;

    const hashIndex = urlText.indexOf("#");
    const hash = hashIndex >= 0 ? urlText.slice(hashIndex) : "";
    const base = hashIndex >= 0 ? urlText.slice(0, hashIndex) : urlText;
    const queryIndex = base.indexOf("?");
    const path = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
    const query = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";
    const searchParams = new URLSearchParams(query);

    Object.keys(params || {}).forEach((key) => {
        const value = params[key];
        if (value === undefined || value === null || value === "") return;
        searchParams.set(key, String(value));
    });

    const nextQuery = searchParams.toString();
    return `${path}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}

function normalizeChannelName(channelName) {
    let next = String(channelName || "").trim();
    if (!next) return "";
    if (next.charAt(0) !== "/") next = `/${next}`;
    return next
        .replace(/\./g, "_")
        .replace(/\-/g, "_")
        .replace(/:/g, "_");
}

function normalizeCmdValue(cmd) {
    if (Array.isArray(cmd) && cmd.length > 0) return String(cmd[0] || "").trim();
    return String(cmd || "").trim();
}

function firstNonEmptyString(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const text = String(value);
        if (text.length > 0) return text;
    }
    return "";
}

function extractPayloadObject(raw) {
    if (!raw || typeof raw !== "object") return {};

    if (raw.data && typeof raw.data === "object") {
        return raw.data;
    }

    if (typeof raw.data === "string") {
        const parsed = parseJson(raw.data, null);
        if (parsed && typeof parsed === "object") {
            return parsed;
        }
    }

    return raw;
}

function normalizeInboundEvent(cmd, rawMessage) {
    const raw = rawMessage && typeof rawMessage === "object" ? rawMessage : {};
    const payload = extractPayloadObject(raw);
    const command = normalizeCmdValue(cmd || raw._cmd || payload._cmd || raw.type || payload.type || "");
    const message = firstNonEmptyString(payload.message, raw.message, payload.text, raw.text);
    const username = firstNonEmptyString(payload.username, raw.username, payload.user, raw.user);
    const type = firstNonEmptyString(payload.type, raw.type, "text/plain");
    const timestampValue = Number(payload.timestamp ?? raw.timestamp ?? 0);
    const timestamp = Number.isFinite(timestampValue) && timestampValue > 0
        ? timestampValue
        : Math.floor(Date.now() / 1000);

    return {
        command,
        message,
        username,
        type,
        timestamp,
        payload,
        raw,
    };
}

function ensureFayeBrowser() {
    if (window.Faye && typeof window.Faye.Client === "function") {
        return Promise.resolve(window.Faye);
    }

    if (fayeLoadPromise) {
        return fayeLoadPromise;
    }

    fayeLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-kilroy-webwidget-faye="${FAYE_BROWSER_URL}"]`);
        if (existing) {
            existing.addEventListener("load", () => resolve(window.Faye), { once: true });
            existing.addEventListener("error", () => reject(new Error("Failed to load Faye browser client")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = FAYE_BROWSER_URL;
        script.async = true;
        script.dataset.kilroyWebwidgetFaye = FAYE_BROWSER_URL;
        script.addEventListener("load", () => {
            if (window.Faye && typeof window.Faye.Client === "function") {
                resolve(window.Faye);
            } else {
                reject(new Error("Faye browser client did not initialize"));
            }
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("Failed to load Faye browser client")), { once: true });
        document.head.appendChild(script);
    }).catch((error) => {
        fayeLoadPromise = null;
        throw error;
    });

    return fayeLoadPromise;
}

class WebWidgetSdk {
    constructor(options = {}) {
        this.alias = options.alias || bootstrapParams.alias || bootstrapParams.webwidget_alias || "";
        this.guid = options.guid || bootstrapParams.guid || bootstrapParams.webwidget_guid || "";
        this.targetOrigin = options.targetOrigin || window.location.origin;
        this.pubsubUrl = options.pubsubUrl || "/ws";
        this.focusBridgeEnabled = options.focusBridgeEnabled !== undefined
            ? Boolean(options.focusBridgeEnabled)
            : true;
        this.lifecycleState = bootstrapParams.webwidget_lifecycle || "WIDGET_OPEN";
        this.closeEvent = WIDGET_CLOSING_EVENT;
        this.messageFilters = [];
        this.kv = {};
        this.connected = false;
        this._localBindingsActive = false;
        this._connectingPromise = null;
        this._fayeClient = null;
        this._fayeSubscription = null;
        this._messageHandlers = new Set();
        this._connectionHandlers = new Set();
        this._lifecycleHandlers = new Set();
        this._boundWindowMessage = this._handleWindowMessage.bind(this);
        this._focusBridgeCleanup = null;

        const bootstrapFilters = parseJson(bootstrapParams.webwidget_message_filters || bootstrapParams.message_filters, []);
        if (Array.isArray(bootstrapFilters)) {
            this.messageFilters = bootstrapFilters.map((value) => String(value)).filter(Boolean);
        }

        const bootstrapKv = parseJson(bootstrapParams.webwidget_kv || bootstrapParams.kv, {});
        if (bootstrapKv && typeof bootstrapKv === "object") {
            Object.keys(bootstrapKv).forEach((key) => {
                this.kv[`ww_${key.replace(/^ww_/, "")}`] = bootstrapKv[key];
            });
        }

        this._getBaseUrl = () => `/api/v1/pd/webhook`;
        this._getSyncBaseUrl = () => `/api/v1/pd/webhook_sync`;
    }

    init() {
        this.ready = this.connect();
        return this;
    }

    connect() {
        if (this.connected) return Promise.resolve(this);
        if (this._connectingPromise) return this._connectingPromise;

        this._ensureLocalBindings();

        if (!this.alias) {
            const error = new Error("Cannot connect webwidget SDK without an alias");
            this._emitConnectionState({ connected: false, state: "error", error: error.message });
            return Promise.reject(error);
        }

        this._emitConnectionState({ connected: false, state: "connecting" });

        this._connectingPromise = ensureFayeBrowser()
            .then(() => this._connectFaye())
            .then(() => {
                this.connected = true;
                this._emitConnectionState({ connected: true, state: "connected" });
                this._emitLifecycle({ event: "WIDGET_CONNECTED" });
                this._postToParent({ _webwidget: true, type: "ready", alias: this.alias, guid: this.guid });
                void this.getMessageFilters().catch(() => {});
                return this;
            })
            .catch((error) => {
                this.connected = false;
                this._emitConnectionState({ connected: false, state: "error", error: error && error.message ? error.message : String(error) });
                throw error;
            })
            .finally(() => {
                this._connectingPromise = null;
            });

        return this._connectingPromise;
    }

    disconnect() {
        if (this._fayeSubscription && typeof this._fayeSubscription.cancel === "function") {
            this._fayeSubscription.cancel();
            this._fayeSubscription = null;
        }

        if (this._fayeClient && typeof this._fayeClient.disconnect === "function") {
            try {
                this._fayeClient.disconnect();
            }
            catch (_err) {
                // ignore disconnect errors from Faye transport teardown
            }
        }
        this._fayeClient = null;

        this._teardownLocalBindings();
        this.connected = false;
        this._emitConnectionState({ connected: false, state: "disconnected" });
        this._emitLifecycle({ event: this.closeEvent });
        return this;
    }

    sendMessage(message, meta = {}) {
        const text = (message || "").toString();
        const type = (meta && meta.type ? String(meta.type) : "text/plain");
        const username = (meta && meta.username ? String(meta.username) : "webwidget");
        const timestamp = Number(meta && meta.timestamp) || Math.floor(Date.now() / 1000);
        const workflowPayload = {
            ...(meta && typeof meta === "object" ? meta : {}),
            username,
            message: text,
            text,
            type,
            timestamp,
        };
        const payload = {
            _webwidget: true,
            type: "message",
            alias: this.alias,
            guid: this.guid,
            message: text,
            meta,
            filters: [...this.messageFilters],
        };
        this._postToParent(payload);
        return this._postWorkflow("swarm_send_hook", workflowPayload).then((response) => ({ success: true, payload, response }));
    }

    setMessageFilters(regexStrings) {
        const next = Array.isArray(regexStrings) ? regexStrings : [];
        this.messageFilters = next.map((value) => String(value)).filter(Boolean);
        const payload = { filters: [...this.messageFilters], regex_strings: [...this.messageFilters], message_filters: [...this.messageFilters] };
        this._postToParent({
            _webwidget: true,
            type: "set_message_filters",
            alias: this.alias,
            guid: this.guid,
            ...payload,
        });
        return this._postWorkflow("set_message_filters", payload).then(() => [...this.messageFilters]);
    }

    getMessageFilters() {
        return this._postWorkflowSync("get_message_filters", {}).then((response) => {
            const result = response && response.args ? (response.args.results ?? response.args.x ?? response.args.value ?? response.args) : null;
            const next = Array.isArray(result && result.webwidget_message_filters) ? result.webwidget_message_filters : null;
            const nextJson = result && result.webwidget_message_filters_json ? result.webwidget_message_filters_json : null;
            const filters = next || parseJson(nextJson, []);
            this.messageFilters = Array.isArray(filters) ? filters.map((value) => String(value)).filter(Boolean) : [];
            return [...this.messageFilters];
        }).catch(() => [...this.messageFilters]);
    }

    setKV(key, value) {
        const kvKey = `ww_${String(key || "").replace(/^ww_/, "")}`;
        this.kv[kvKey] = value;
        const payload = { key: kvKey, value };
        this._postToParent({
            _webwidget: true,
            type: "set_kv",
            alias: this.alias,
            guid: this.guid,
            ...payload,
        });
        return this._postWorkflow("set_kv", payload).then(() => value);
    }

    getKV(key, fallback = undefined) {
        const kvKey = `ww_${String(key || "").replace(/^ww_/, "")}`;
        return this._postWorkflowSync("get_kv", { key: kvKey }).then((response) => {
            const result = response && response.args ? (response.args.results ?? response.args.x ?? response.args.value ?? response.args) : null;
            const value = result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, kvKey)
                ? result[kvKey]
                : (result && Object.prototype.hasOwnProperty.call(result, "webwidget_kv_value") ? result.webwidget_kv_value : fallback);
            if (value !== undefined) this.kv[kvKey] = value;
            return value === undefined ? fallback : value;
        }).catch(() => Object.prototype.hasOwnProperty.call(this.kv, kvKey) ? this.kv[kvKey] : fallback);
    }

    onMessage(handler) {
        this._messageHandlers.add(handler);
        return () => this._messageHandlers.delete(handler);
    }

    onConnectionState(handler) {
        this._connectionHandlers.add(handler);
        return () => this._connectionHandlers.delete(handler);
    }

    onLifecycle(handler) {
        this._lifecycleHandlers.add(handler);
        return () => this._lifecycleHandlers.delete(handler);
    }

    _ensureLocalBindings() {
        if (this._localBindingsActive) return;
        this._localBindingsActive = true;
        window.addEventListener("message", this._boundWindowMessage);
        if (this.focusBridgeEnabled) {
            this._focusBridgeCleanup = initIframeFocusBridge({
                enabled: true,
                pdalias: this.alias,
                targetOrigin: this.targetOrigin,
            });
        }
    }

    _teardownLocalBindings() {
        if (!this._localBindingsActive) return;
        this._localBindingsActive = false;
        window.removeEventListener("message", this._boundWindowMessage);
        if (typeof this._focusBridgeCleanup === "function") {
            this._focusBridgeCleanup();
            this._focusBridgeCleanup = null;
        }
    }

    _connectFaye() {
        const client = new window.Faye.Client(this.pubsubUrl);
        if (typeof client.disable === "function") {
            client.disable("logging");
        }

        if (typeof client.on === "function") {
            client.on("transport:up", () => {
                this._emitConnectionState({ connected: true, state: "transport_up" });
            });
            client.on("transport:down", () => {
                this.connected = false;
                this._emitConnectionState({ connected: false, state: "transport_down" });
            });
        }

        this._fayeClient = client;

        return new Promise((resolve, reject) => {
            const normalizedChannel = normalizeChannelName(this.alias);
            if (!normalizedChannel) {
                reject(new Error("Cannot subscribe without a normalized alias channel"));
                return;
            }

            try {
                this._fayeSubscription = client.subscribe(normalizedChannel, (rawMessage) => {
                    const event = normalizeInboundEvent(rawMessage && rawMessage._cmd, rawMessage);
                    if (event.command.toUpperCase() !== "MESSAGE_RECEIVED") {
                        return;
                    }
                    this._emitMessage(event);
                });

                resolve(this._fayeSubscription);
            }
            catch (error) {
                reject(error);
            }
        });
    }

    _postToParent(payload) {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, this.targetOrigin || "*");
            }
        } catch (_err) {}
    }

    _workflowUrl(name, sync = false) {
        const base = sync ? this._getSyncBaseUrl() : this._getBaseUrl();
        return `${base}/API_TOKEN/${this.alias}/${name}`;
    }

    _postWorkflow(name, body) {
        return fetch(this._workflowUrl(name, false), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CONCLUENT-TOKEN": window.CURR_AUTH_TOKEN || ""
            },
            body: JSON.stringify(body || {})
        }).then((response) => response.json());
    }

    _postWorkflowSync(name, body) {
        return fetch(this._workflowUrl(name, true), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CONCLUENT-TOKEN": window.CURR_AUTH_TOKEN || ""
            },
            body: JSON.stringify(body || {})
        }).then((response) => response.json());
    }

    _emitMessage(payload) {
        this._messageHandlers.forEach((handler) => {
            try { handler(payload); } catch (_err) {}
        });
    }

    _emitConnectionState(payload) {
        this._connectionHandlers.forEach((handler) => {
            try { handler(payload); } catch (_err) {}
        });
    }

    _emitLifecycle(payload) {
        this.lifecycleState = payload && payload.event ? payload.event : this.lifecycleState;
        this._lifecycleHandlers.forEach((handler) => {
            try { handler(payload); } catch (_err) {}
        });
    }

    _handleWindowMessage(event) {
        const data = event && event.data ? event.data : {};
        if (!data || data._webwidget !== true) return;

        if (data.type === "message") {
            this._emitMessage(normalizeInboundEvent("MESSAGE_RECEIVED", data));
            return;
        }

        if (data.type === "set_message_filters") {
            this.messageFilters = Array.isArray(data.filters) ? data.filters.map((value) => String(value)).filter(Boolean) : [];
            return;
        }

        if (data.type === "set_kv" && data.key) {
            this.kv[String(data.key)] = data.value;
            return;
        }

        if (data.type === "connection_state") {
            this._emitConnectionState(data);
            return;
        }

        if (data.type === "lifecycle") {
            this._emitLifecycle(data);
        }
    }
}

export function initWebWidget(options = {}) {
    const sdk = new WebWidgetSdk(options).init();
    window.__kilroyWebWidgetSdk = sdk;
    window.WebWidgetSDK = sdk;
    window.initWebWidget = initWebWidget;
    return sdk;
}

window.initWebWidget = initWebWidget;
window.WebWidgetSDK = window.WebWidgetSDK || null;

export { appendQueryParams, WebWidgetSdk };