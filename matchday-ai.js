/* ============================================================
   MATCHDAY AI — Application Logic
   Sections: Settings/BYOK · LLM Client · Mock Feeds · Ticker ·
             Tabs · Assistant (Chat) · Ops (Crowd + Ops Intel) ·
             Volunteer (Incident/Decision Support) · Sustainability
   ============================================================
   NOTE ON "SIMULATED" LABELS: every *_MOCK_* data object below
   stands in for a live sensor/transit/weather feed that this
   static prototype has no access to. The reasoning performed on
   top of that data (callLLM) is a REAL network call to an LLM —
   nothing here fabricates a model response client-side. See
   ALIGNMENT.md for the full category-by-category mapping.
   ============================================================ */

(function () {
  'use strict';

  /* ---------------- Settings / Connection mode ---------------- */
  const SETTINGS_KEY = 'matchdayAiSettings';

  // Two ways to reach the LLM:
  //  - 'proxy'  (default when served over http/https): browser calls our own
  //             /api/llm endpoint; the key lives only in the server's .env.
  //  - 'direct' (bring-your-own-key): browser calls the LLM API directly
  //             using a key stored in localStorage. Needed when the page is
  //             opened via file:// (no server), since /api/llm won't exist.
  function defaultMode() {
    return window.location.protocol === 'file:' ? 'direct' : 'proxy';
  }

  function getSettings() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
      stored = {};
    }
    return Object.assign({ mode: defaultMode() }, stored);
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function clearApiKey() {
    const s = getSettings();
    delete s.apiKey;
    saveSettings(s);
  }

  let serverStatusCache = null; // { configured, model } | null (unknown) | false (unreachable)

  async function checkServerStatus() {
    try {
      const res = await fetch('/api/llm/status', { method: 'GET' });
      if (!res.ok) throw new Error('bad status');
      serverStatusCache = await res.json();
    } catch (e) {
      serverStatusCache = false;
    }
    return serverStatusCache;
  }

  async function isReady() {
    const settings = getSettings();
    if (settings.mode === 'direct') return !!settings.apiKey;
    const status = serverStatusCache !== null ? serverStatusCache : await checkServerStatus();
    return !!(status && status.configured);
  }

  /* ---------------- LLM Client ---------------- */
  class LLMConfigError extends Error {}

  async function callLLM(messages, opts) {
    opts = opts || {};
    const settings = getSettings();

    if (settings.mode === 'direct') {
      if (!settings.apiKey) throw new LLMConfigError('No API key configured (Direct Browser mode).');
      const baseUrl = settings.baseUrl || 'https://api.openai.com/v1/chat/completions';
      const model = settings.model || 'gpt-4o-mini';
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.apiKey,
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: opts.temperature != null ? opts.temperature : 0.4,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(function () { return ''; });
        throw new Error('LLM request failed (' + res.status + '): ' + body.slice(0, 200));
      }
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('LLM returned an empty response.');
      return content.trim();
    }

    // Proxy mode: key stays server-side, browser only talks to our own API.
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages, temperature: opts.temperature != null ? opts.temperature : 0.4 }),
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      if (res.status === 500 && data.error && /no LLM API key configured/i.test(data.error)) {
        throw new LLMConfigError(data.error);
      }
      throw new Error(data.error || ('Proxy request failed (' + res.status + ')'));
    }
    if (!data.content) throw new Error('LLM returned an empty response.');
    return data.content;
  }

  function apiKeyPromptHtml() {
    const settings = getSettings();
    if (settings.mode === 'direct') {
      return 'No API key configured yet. <a data-open-settings>Add your API key in Settings</a> to enable real GenAI reasoning for this feature.';
    }
    return 'The server has no LLM key configured yet. Add <code>OPENAI_API_KEY</code> to <code>.env</code> and restart the server, or switch to Direct Browser mode in <a data-open-settings>Settings</a>.';
  }

  /* ---------------- Mock Feeds (simulated data — see ALIGNMENT.md) ---------------- */
  const KICKOFF = new Date('June 11, 2026 18:00:00');

  const MOCK_POIS = [
    { name: 'Gate A', type: 'entrance', note: 'Step-free ramp entrance, closest to Metro station' },
    { name: 'Gate B', type: 'entrance', note: 'Standard entrance, longest queues typically' },
    { name: 'Gate C', type: 'entrance', note: 'Accessible entrance, drop-off zone adjacent' },
    { name: 'Gate D', type: 'entrance', note: 'Standard entrance, closest to VIP parking' },
    { name: 'Section 114', type: 'seating', note: 'Lower tier, accessible via Gate C + elevator bank 2' },
    { name: 'Section 220', type: 'seating', note: 'Upper tier, accessible via Gate A + elevator bank 1' },
    { name: 'First Aid Post 1', type: 'medical', note: 'Concourse level, near Gate B' },
    { name: 'First Aid Post 2', type: 'medical', note: 'Upper concourse, near Section 220' },
    { name: 'Family Restroom', type: 'restroom', note: 'Near Gate C, baby-changing facilities' },
    { name: 'Sensory Room', type: 'accessibility', note: 'Quiet low-stimulation room, concourse level near Gate C' },
  ];

  const MOCK_ACCESSIBILITY = [
    'Wheelchair-accessible seating in every section, bookable in advance',
    'Sensory room near Gate C for fans with sensory sensitivities (noise/light reduced)',
    'Hearing loop system active at all public announcement points',
    'Service animal relief areas located outside Gates A and C',
    'Accessible drop-off zone at Gate C for rideshare/paratransit',
    'Large-print and braille programs available at any information desk',
  ];

  const MOCK_TRANSIT = {
    metro: { line: 'Blue Line', status: 'Running, 6 min frequency', nearestStation: 'Stadium Central (Gate A)' },
    rideshare: { status: 'Surge pricing active (1.8x)', dropoff: 'Lot C, 8 min walk to Gate D' },
    parking: { general: '62% full', accessible: '18% full', vip: '90% full' },
    shuttle: { status: 'Running every 12 min from Downtown Transit Hub' },
  };

  const MOCK_WEATHER = { condition: 'Clear', tempC: 24, windKph: 14, note: 'No precipitation expected before kickoff' };

  const MOCK_GATES = [
    { name: 'Gate A', occupancyPct: 42 },
    { name: 'Gate B', occupancyPct: 71 },
    { name: 'Gate C', occupancyPct: 35 },
    { name: 'Gate D', occupancyPct: 58 },
  ];

  const INCIDENT_LOG = [
    { text: 'Minor spill reported near Section 108 concourse', severity: 'low', category: 'facilities', time: '17:42' },
    { text: 'Long queue building at Gate B security lanes', severity: 'medium', category: 'general', time: '17:38' },
  ];

  /* ---------------- Gate occupancy drift (simulated live feed) ---------------- */
  function driftGates() {
    MOCK_GATES.forEach(function (g) {
      const delta = Math.round((Math.random() - 0.45) * 6);
      g.occupancyPct = Math.max(5, Math.min(98, g.occupancyPct + delta));
    });
  }

  function gateColor(pct) {
    if (pct >= 80) return 'var(--red)';
    if (pct >= 55) return 'var(--amber)';
    return 'var(--green)';
  }

  function renderGateGrid() {
    const grid = document.getElementById('gate-grid');
    if (!grid) return;
    grid.innerHTML = MOCK_GATES.map(function (g) {
      const color = gateColor(g.occupancyPct);
      const critical = g.occupancyPct >= 80;
      return (
        '<div class="gate-card">' +
          '<div class="gate-card-header">' +
            '<span class="gate-name">' + g.name + '</span>' +
            '<span class="gate-pct" style="color:' + color + '">' + g.occupancyPct + '%</span>' +
          '</div>' +
          '<div class="gate-bar-track"><div class="gate-bar-fill' + (critical ? ' pulse' : '') + '" style="width:' + g.occupancyPct + '%;background:' + color + '"></div></div>' +
          '<div class="gate-status">' + (critical ? 'CRITICAL DENSITY' : g.occupancyPct >= 55 ? 'BUSY' : 'CLEAR') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ---------------- Ticker (repurposed: live ops status, not fake scores) ---------------- */
  function renderTicker() {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    const items = [];
    MOCK_GATES.forEach(function (g) {
      items.push('<span class="ticker-item"><strong>' + g.name + '</strong> occupancy ' + g.occupancyPct + '%</span>');
    });
    items.push('<span class="ticker-item">Weather: <strong>' + MOCK_WEATHER.condition + ', ' + MOCK_WEATHER.tempC + '&deg;C</strong></span>');
    items.push('<span class="ticker-item">Metro: <strong>' + MOCK_TRANSIT.metro.status + '</strong></span>');
    if (INCIDENT_LOG.length) {
      items.push('<span class="ticker-item">Latest report: <strong>' + INCIDENT_LOG[0].text + '</strong></span>');
    }
    track.innerHTML = items.concat(items).join(''); // duplicate for seamless loop
  }

  /* ---------------- Tabs ---------------- */
  function setupTabs() {
    const buttons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
    const panels = Array.prototype.slice.call(document.querySelectorAll('.tab-panel'));
    function activate(name) {
      buttons.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
      panels.forEach(function (p) { p.setAttribute('aria-hidden', String(p.id !== 'tab-' + name)); });
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { activate(b.dataset.tab); });
    });
    activate(buttons.length ? buttons[0].dataset.tab : 'assistant');
  }

  /* ---------------- Settings Modal ---------------- */
  function setupSettingsModal() {
    const overlay = document.getElementById('settings-modal');
    const openBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('settings-close');
    const saveBtn = document.getElementById('settings-save');
    const clearBtn = document.getElementById('settings-clear');
    const dot = document.getElementById('key-status-dot');
    const modeProxyRadio = document.getElementById('settings-mode-proxy');
    const modeDirectRadio = document.getElementById('settings-mode-direct');
    const directFields = document.getElementById('settings-direct-fields');
    const proxyStatusEl = document.getElementById('settings-proxy-status');
    const baseUrlInput = document.getElementById('settings-baseurl');
    const modelInput = document.getElementById('settings-model');
    const keyInput = document.getElementById('settings-key');

    async function refreshDot() {
      if (!dot) return;
      dot.classList.toggle('set', await isReady());
    }

    function syncModeUI() {
      const direct = modeDirectRadio.checked;
      directFields.style.display = direct ? '' : 'none';
      proxyStatusEl.style.display = direct ? 'none' : '';
    }

    async function refreshProxyStatus() {
      const status = await checkServerStatus();
      if (!status) {
        proxyStatusEl.textContent = 'Server proxy not reachable (are you opening this via file://? Run "npm start" and use http://localhost:3000 instead).';
        proxyStatusEl.className = 'ai-error';
      } else if (status.configured) {
        proxyStatusEl.textContent = 'Server key is configured (model: ' + status.model + '). No key needed in the browser.';
        proxyStatusEl.className = 'hint';
      } else {
        proxyStatusEl.textContent = 'Server is running but has no OPENAI_API_KEY set. Add it to .env and restart "npm start".';
        proxyStatusEl.className = 'ai-error';
      }
    }

    function openModal() {
      const s = getSettings();
      modeProxyRadio.checked = s.mode !== 'direct';
      modeDirectRadio.checked = s.mode === 'direct';
      baseUrlInput.value = s.baseUrl || 'https://api.openai.com/v1/chat/completions';
      modelInput.value = s.model || 'gpt-4o-mini';
      keyInput.value = s.apiKey || '';
      syncModeUI();
      refreshProxyStatus();
      overlay.classList.add('open');
    }
    function closeModal() { overlay.classList.remove('open'); }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    [modeProxyRadio, modeDirectRadio].forEach(function (r) {
      if (r) r.addEventListener('change', syncModeUI);
    });
    if (saveBtn) saveBtn.addEventListener('click', function () {
      saveSettings({
        mode: modeDirectRadio.checked ? 'direct' : 'proxy',
        baseUrl: baseUrlInput.value.trim(),
        model: modelInput.value.trim(),
        apiKey: keyInput.value.trim(),
      });
      refreshDot();
      closeModal();
    });
    if (clearBtn) clearBtn.addEventListener('click', function () {
      clearApiKey();
      keyInput.value = '';
      refreshDot();
    });

    document.addEventListener('click', function (e) {
      if (e.target && e.target.hasAttribute('data-open-settings')) {
        e.preventDefault();
        openModal();
      }
    });

    refreshDot();
  }

  /* ---------------- Assistant (Chat) — Navigation + Accessibility + Transport + Multilingual ---------------- */
  let assistantFocus = 'general';
  let currentLang = 'en';

  const LANG_NAMES = { en: 'English', es: 'Spanish', fr: 'French', ar: 'Arabic', pt: 'Portuguese' };

  function buildAssistantSystemPrompt() {
    return [
      'You are the Matchday AI Assistant for a FIFA World Cup 2026 host stadium.',
      'Respond in ' + (LANG_NAMES[currentLang] || 'English') + ' only, regardless of the language the user typed in.',
      'Current focus area the fan selected: ' + assistantFocus + ' (one of general, navigation, accessibility, transport).',
      'Use ONLY the following venue data to ground your answer; do not invent stadium facts beyond it:',
      'Points of interest: ' + JSON.stringify(MOCK_POIS),
      'Accessibility features: ' + JSON.stringify(MOCK_ACCESSIBILITY),
      'Transportation status (simulated live feed): ' + JSON.stringify(MOCK_TRANSIT),
      'Weather (simulated): ' + JSON.stringify(MOCK_WEATHER),
      'Be concise (max ~80 words), practical, and give concrete next steps (which gate, which route, which service).',
    ].join('\n');
  }

  const chatHistory = [];

  function addBubble(text, role) {
    const messages = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'bubble bubble--' + role;
    el.innerHTML = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const text = input.value.trim();
    if (!text) return;
    addBubble(escapeHtml(text), 'user');
    chatHistory.push({ role: 'user', content: text });
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    const typing = addBubble('Thinking&hellip;', 'ai bubble--typing');

    try {
      const reply = await callLLM([
        { role: 'system', content: buildAssistantSystemPrompt() },
      ].concat(chatHistory.slice(-6)));
      chatHistory.push({ role: 'assistant', content: reply });
      typing.classList.remove('bubble--typing');
      typing.innerHTML = reply.replace(/\n/g, '<br>');
    } catch (err) {
      typing.classList.remove('bubble--typing');
      if (err instanceof LLMConfigError) {
        typing.outerHTML = '<div class="ai-error">' + apiKeyPromptHtml() + '</div>';
      } else {
        typing.outerHTML = '<div class="ai-error">GenAI request failed: ' + escapeHtml(err.message) + '</div>';
      }
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function setupAssistant() {
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const chips = Array.prototype.slice.call(document.querySelectorAll('.quick-chips .chip'));
    const langSelect = document.getElementById('lang-select');

    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChatMessage(); });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        assistantFocus = chip.dataset.focus;
        input.placeholder = chip.dataset.placeholder || 'Ask the assistant…';
      });
    });

    if (langSelect) {
      langSelect.addEventListener('change', function () {
        currentLang = langSelect.value;
        document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', currentLang);
      });
    }

    if (document.getElementById('chat-messages').children.length === 0) {
      addBubble('Welcome to Matchday AI. Pick a focus area (Navigation, Accessibility, Transport) or just ask anything about getting around the stadium today.', 'ai');
    }
  }

  /* ---------------- Ops: Crowd management + Operational intelligence ---------------- */
  async function generateGateForecast() {
    const btn = document.getElementById('gate-forecast-btn');
    const out = document.getElementById('gate-forecast-result');
    btn.disabled = true;
    out.classList.add('visible');
    out.innerHTML = '<span class="ai-loading">Analyzing gate trends&hellip;</span>';
    try {
      const minsToKickoff = Math.max(0, Math.round((KICKOFF - Date.now()) / 60000));
      const reply = await callLLM([
        { role: 'system', content: 'You are a stadium crowd-management analyst. Given per-gate occupancy percentages and minutes remaining to kickoff, predict which gates will become congested in the next 15-30 minutes and recommend which gate(s) staff should direct incoming fans toward. Be specific and reference gate names. Max 70 words.' },
        { role: 'user', content: 'Gate occupancy now: ' + JSON.stringify(MOCK_GATES) + '. Minutes to kickoff: ' + minsToKickoff + '.' },
      ], { temperature: 0.3 });
      out.innerHTML = reply.replace(/\n/g, '<br>');
    } catch (err) {
      out.innerHTML = err instanceof LLMConfigError ? apiKeyPromptHtml() : '<span class="ai-error">GenAI request failed: ' + escapeHtml(err.message) + '</span>';
    } finally {
      btn.disabled = false;
    }
  }

  async function generateOpsBrief() {
    const btn = document.getElementById('ops-brief-btn');
    const out = document.getElementById('ops-brief-result');
    btn.disabled = true;
    out.classList.add('visible');
    out.innerHTML = '<span class="ai-loading">Synthesizing operational briefing&hellip;</span>';
    try {
      const minsToKickoff = Math.max(0, Math.round((KICKOFF - Date.now()) / 60000));
      const reply = await callLLM([
        { role: 'system', content: 'You are an operational intelligence assistant for FIFA World Cup venue staff. Synthesize the given gate occupancy, incident log, weather, and transit feeds into a short prioritized staff briefing (3-5 bullet points) with recommended actions. This is for organizers/venue staff, not fans.' },
        { role: 'user', content: JSON.stringify({
            minutesToKickoff: minsToKickoff,
            gates: MOCK_GATES,
            incidents: INCIDENT_LOG,
            weather: MOCK_WEATHER,
            transit: MOCK_TRANSIT,
          }) },
      ], { temperature: 0.3 });
      out.innerHTML = reply.replace(/\n/g, '<br>');
    } catch (err) {
      out.innerHTML = err instanceof LLMConfigError ? apiKeyPromptHtml() : '<span class="ai-error">GenAI request failed: ' + escapeHtml(err.message) + '</span>';
    } finally {
      btn.disabled = false;
    }
  }

  function setupOps() {
    renderGateGrid();
    const forecastBtn = document.getElementById('gate-forecast-btn');
    const briefBtn = document.getElementById('ops-brief-btn');
    if (forecastBtn) forecastBtn.addEventListener('click', generateGateForecast);
    if (briefBtn) briefBtn.addEventListener('click', generateOpsBrief);

    setInterval(function () {
      driftGates();
      renderGateGrid();
      renderTicker();
    }, 4000);
  }

  /* ---------------- Volunteer: Real-time decision support (incident classifier) ---------------- */
  function tagClassFor(category) {
    const map = { security: 'tag--security', medical: 'tag--medical', facilities: 'tag--facilities', transport: 'tag--transport' };
    return map[category] || 'tag--general';
  }

  function renderIncidentLog() {
    const log = document.getElementById('incident-log');
    if (!log) return;
    log.innerHTML = INCIDENT_LOG.map(function (i) {
      return (
        '<div class="incident-item" data-severity="' + i.severity + '">' +
          '<span class="tag ' + tagClassFor(i.category) + '">' + i.category.toUpperCase() + '</span> ' + escapeHtml(i.text) +
          '<div class="incident-meta"><span>Severity: ' + i.severity + '</span><span>' + i.time + '</span></div>' +
        '</div>'
      );
    }).join('');
  }

  async function classifyIncident() {
    const textarea = document.getElementById('incident-text');
    const btn = document.getElementById('incident-submit-btn');
    const out = document.getElementById('incident-result');
    const text = textarea.value.trim();
    if (!text) return;
    btn.disabled = true;
    out.classList.add('visible');
    out.innerHTML = '<span class="ai-loading">Classifying and generating response guidance&hellip;</span>';
    try {
      const reply = await callLLM([
        { role: 'system', content: [
            'You are a real-time decision-support system for stadium volunteers/staff.',
            'Given a free-text incident report, respond with STRICT JSON only, no prose, matching this shape:',
            '{"category": one of security|medical|facilities|transport|general, "severity": one of low|medium|high, "action": "one specific, actionable next step a volunteer should take right now, max 30 words"}',
          ].join('\n') },
        { role: 'user', content: text },
      ], { temperature: 0.2 });

      let parsed;
      try {
        parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
      } catch (parseErr) {
        throw new Error('Could not parse model output as JSON: ' + reply.slice(0, 120));
      }

      out.innerHTML =
        '<span class="tag ' + tagClassFor(parsed.category) + '">' + String(parsed.category).toUpperCase() + '</span> ' +
        '<strong>Severity: ' + escapeHtml(parsed.severity) + '</strong><br>' +
        'Recommended action: ' + escapeHtml(parsed.action);

      INCIDENT_LOG.unshift({
        text: text,
        severity: parsed.severity,
        category: parsed.category,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      renderIncidentLog();
      renderTicker();
      textarea.value = '';
    } catch (err) {
      out.innerHTML = err instanceof LLMConfigError ? apiKeyPromptHtml() : '<span class="ai-error">GenAI request failed: ' + escapeHtml(err.message) + '</span>';
    } finally {
      btn.disabled = false;
    }
  }

  function setupVolunteer() {
    renderIncidentLog();
    const btn = document.getElementById('incident-submit-btn');
    if (btn) btn.addEventListener('click', classifyIncident);
  }

  /* ---------------- Sustainability: Waste sorting identifier ---------------- */
  async function classifyWasteItem() {
    const input = document.getElementById('bin-item-input');
    const btn = document.getElementById('bin-submit-btn');
    const out = document.getElementById('bin-result');
    const text = input.value.trim();
    if (!text) return;
    btn.disabled = true;
    out.classList.add('visible');
    out.innerHTML = '<span class="ai-loading">Reasoning about disposal category&hellip;</span>';
    try {
      const reply = await callLLM([
        { role: 'system', content: [
            'You are a sustainability assistant classifying stadium waste items.',
            'Given a free-text description of an item (may be messy/mixed materials), respond with STRICT JSON only:',
            '{"bin": one of recycle|compost|landfill|hazardous, "reason": "one short sentence explaining why, max 25 words"}',
          ].join('\n') },
        { role: 'user', content: text },
      ], { temperature: 0.2 });

      let parsed;
      try {
        parsed = JSON.parse(reply.replace(/```json|```/g, '').trim());
      } catch (parseErr) {
        throw new Error('Could not parse model output as JSON: ' + reply.slice(0, 120));
      }

      out.innerHTML = '<strong>' + String(parsed.bin).toUpperCase() + ' BIN</strong><br>' + escapeHtml(parsed.reason);
    } catch (err) {
      out.innerHTML = err instanceof LLMConfigError ? apiKeyPromptHtml() : '<span class="ai-error">GenAI request failed: ' + escapeHtml(err.message) + '</span>';
    } finally {
      btn.disabled = false;
    }
  }

  function setupSustainability() {
    const btn = document.getElementById('bin-submit-btn');
    if (btn) btn.addEventListener('click', classifyWasteItem);
  }

  /* ---------------- Header countdown stat ---------------- */
  function setupCountdownStat() {
    const el = document.getElementById('header-countdown');
    if (!el) return;
    function tick() {
      const diff = KICKOFF - Date.now();
      if (diff <= 0) { el.textContent = 'LIVE NOW'; return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      el.textContent = days + 'd ' + hours + 'h to kickoff';
    }
    tick();
    setInterval(tick, 60000);
  }

  /* ---------------- Utils ---------------- */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    setupTabs();
    setupSettingsModal();
    setupAssistant();
    setupOps();
    setupVolunteer();
    setupSustainability();
    setupCountdownStat();
    renderTicker();
  });
})();
