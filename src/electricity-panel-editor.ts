import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  HomeAssistant,
  ElectricityPanelConfig,
  Circuit,
  CircuitDevice,
  DeviceChannel,
} from './types.js';

// ── Small helpers ──────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── Editor ─────────────────────────────────────────────────────────────────

@customElement('electricity-panel-editor')
export class ElectricityPanelEditor extends LitElement {
  // hass is set externally by HA — we use a manual getter/setter
  // so we can populate the datalist exactly once
  private _hass!: HomeAssistant;
  private _datalistFilled = false;

  @state() private _config!: ElectricityPanelConfig;

  // Which circuit index is open for editing (-1 = none)
  @state() private _openCircuit = -1;
  // Which device index inside the open circuit is being edited (-1 = none)
  @state() private _openDevice = -1;

  // ── HA editor API ──────────────────────────────────────────────────────────

  setConfig(config: ElectricityPanelConfig): void {
    this._config = deepClone(config);
  }

  get hass(): HomeAssistant {
    return this._hass;
  }

  set hass(h: HomeAssistant) {
    this._hass = h;
    if (!this._datalistFilled) {
      this.updateComplete.then(() => {
        const dl = this.shadowRoot?.getElementById('ep-entities') as HTMLDataListElement | null;
        if (dl && !this._datalistFilled) {
          dl.innerHTML = Object.keys(h.states)
            .sort()
            .map(id => `<option value="${id}">`)
            .join('');
          this._datalistFilled = true;
        }
      });
    }
  }

  // ── Event helpers ──────────────────────────────────────────────────────────

  private _fire(config: ElectricityPanelConfig): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _set(path: string[], value: unknown): void {
    const cfg = deepClone(this._config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = cfg;
    for (let i = 0; i < path.length - 1; i++) {
      if (node[path[i]] === undefined) node[path[i]] = {};
      node = node[path[i]];
    }
    const last = path[path.length - 1];
    if (value === '' || value === undefined) {
      delete node[last];
    } else {
      node[last] = value;
    }
    this._config = cfg;
    this._fire(cfg);
  }

  private _inputHandler(path: string[]): (e: Event) => void {
    return (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      this._set(path, val);
    };
  }

  private _checkHandler(path: string[]): (e: Event) => void {
    return (e: Event) => {
      const val = (e.target as HTMLInputElement).checked;
      this._set(path, val);
    };
  }

  // ── Circuit management ─────────────────────────────────────────────────────

  private _addCircuit(): void {
    const cfg = deepClone(this._config);
    cfg.circuits ??= [];
    const id = `c${String(cfg.circuits.length + 1).padStart(2, '0')}`;
    cfg.circuits.push({ id, name: 'New circuit', phases: 1 });
    this._config = cfg;
    this._fire(cfg);
    this._openCircuit = cfg.circuits.length - 1;
    this._openDevice = -1;
  }

  private _removeCircuit(idx: number): void {
    const cfg = deepClone(this._config);
    cfg.circuits?.splice(idx, 1);
    this._config = cfg;
    this._fire(cfg);
    this._openCircuit = -1;
    this._openDevice = -1;
  }

  private _moveCircuit(idx: number, dir: -1 | 1): void {
    const cfg = deepClone(this._config);
    const arr = cfg.circuits ?? [];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    this._config = cfg;
    this._fire(cfg);
    this._openCircuit = target;
  }

  private _circuitInput(idx: number, field: keyof Circuit): (e: Event) => void {
    return (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      const cfg = deepClone(this._config);
      const c = cfg.circuits![idx];
      if (val === '') {
        delete (c as Record<string, unknown>)[field];
      } else {
        (c as Record<string, unknown>)[field] = field === 'phases'
          ? parseInt(val) as 1 | 3
          : field === 'max_current'
            ? parseFloat(val)
            : val;
      }
      // Auto-generate id from name
      if (field === 'name' && val) c.id = slugify(val);
      this._config = cfg;
      this._fire(cfg);
    };
  }

  private _circuitCheck(idx: number, field: keyof Circuit): (e: Event) => void {
    return (e: Event) => {
      const val = (e.target as HTMLInputElement).checked;
      const cfg = deepClone(this._config);
      (cfg.circuits![idx] as Record<string, unknown>)[field] = val;
      this._config = cfg;
      this._fire(cfg);
    };
  }

  // ── Device management ──────────────────────────────────────────────────────

  private _addDevice(circuitIdx: number): void {
    const cfg = deepClone(this._config);
    cfg.circuits![circuitIdx].devices ??= [];
    cfg.circuits![circuitIdx].devices!.push({ name: 'New device' });
    this._config = cfg;
    this._fire(cfg);
    this._openDevice = cfg.circuits![circuitIdx].devices!.length - 1;
  }

  private _removeDevice(circuitIdx: number, deviceIdx: number): void {
    const cfg = deepClone(this._config);
    cfg.circuits![circuitIdx].devices?.splice(deviceIdx, 1);
    this._config = cfg;
    this._fire(cfg);
    this._openDevice = -1;
  }

  private _deviceInput(ci: number, di: number, field: keyof CircuitDevice): (e: Event) => void {
    return (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      const cfg = deepClone(this._config);
      const d = cfg.circuits![ci].devices![di];
      if (val === '') delete (d as Record<string, unknown>)[field];
      else (d as Record<string, unknown>)[field] = val;
      this._config = cfg;
      this._fire(cfg);
    };
  }

  // ── Channel management ─────────────────────────────────────────────────────

  private _addChannel(ci: number, di: number): void {
    const cfg = deepClone(this._config);
    cfg.circuits![ci].devices![di].channels ??= [];
    cfg.circuits![ci].devices![di].channels!.push({ name: 'New channel' });
    this._config = cfg;
    this._fire(cfg);
  }

  private _removeChannel(ci: number, di: number, chi: number): void {
    const cfg = deepClone(this._config);
    cfg.circuits![ci].devices![di].channels?.splice(chi, 1);
    this._config = cfg;
    this._fire(cfg);
  }

  private _channelInput(ci: number, di: number, chi: number, field: keyof DeviceChannel): (e: Event) => void {
    return (e: Event) => {
      const val = (e.target as HTMLInputElement).value;
      const cfg = deepClone(this._config);
      const ch = cfg.circuits![ci].devices![di].channels![chi];
      if (val === '') delete (ch as Record<string, unknown>)[field];
      else (ch as Record<string, unknown>)[field] = val;
      this._config = cfg;
      this._fire(cfg);
    };
  }

  // ── Render: entity input ───────────────────────────────────────────────────

  private _entityInput(label: string, value: string | undefined, handler: (e: Event) => void): TemplateResult {
    return html`
      <div class="field">
        <label>${label}</label>
        <input
          list="ep-entities"
          .value=${value ?? ''}
          placeholder="sensor.example"
          @change=${handler}
        />
      </div>
    `;
  }

  private _textInput(label: string, value: string | undefined, handler: (e: Event) => void, placeholder = ''): TemplateResult {
    return html`
      <div class="field">
        <label>${label}</label>
        <input
          type="text"
          .value=${value ?? ''}
          placeholder=${placeholder}
          @input=${handler}
        />
      </div>
    `;
  }

  private _numberInput(label: string, value: number | undefined, handler: (e: Event) => void, placeholder = ''): TemplateResult {
    return html`
      <div class="field">
        <label>${label}</label>
        <input
          type="number"
          .value=${value !== undefined ? String(value) : ''}
          placeholder=${placeholder}
          min="0"
          @change=${handler}
        />
      </div>
    `;
  }

  // ── Render: sections ───────────────────────────────────────────────────────

  private _renderMainMeterSection(): TemplateResult {
    const m = this._config.main_meter ?? {};
    return html`
      <details class="section">
        <summary>Main meter</summary>
        <div class="section-body">
          <div class="field-group-label">Power (W)</div>
          ${this._entityInput('L1 power', m.power_l1, this._inputHandler(['main_meter', 'power_l1']))}
          ${this._entityInput('L2 power', m.power_l2, this._inputHandler(['main_meter', 'power_l2']))}
          ${this._entityInput('L3 power', m.power_l3, this._inputHandler(['main_meter', 'power_l3']))}
          <div class="field-group-label">Current (A)</div>
          ${this._entityInput('L1 current', m.current_l1, this._inputHandler(['main_meter', 'current_l1']))}
          ${this._entityInput('L2 current', m.current_l2, this._inputHandler(['main_meter', 'current_l2']))}
          ${this._entityInput('L3 current', m.current_l3, this._inputHandler(['main_meter', 'current_l3']))}
          <div class="field-group-label">Energy</div>
          ${this._entityInput('Energy today (kWh)', m.energy_today, this._inputHandler(['main_meter', 'energy_today']))}
        </div>
      </details>
    `;
  }

  private _renderHdoSection(): TemplateResult {
    const h = this._config.hdo ?? {};
    return html`
      <details class="section">
        <summary>HDO (time-of-use tariff)</summary>
        <div class="section-body">
          ${this._entityInput('HDO switch (on = NT)', h.switch, this._inputHandler(['hdo', 'switch']))}
          ${this._entityInput('Next high tariff start sensor', h.next_high, this._inputHandler(['hdo', 'next_high']))}
          ${this._entityInput('Next low tariff start sensor', h.next_low, this._inputHandler(['hdo', 'next_low']))}
          ${this._entityInput('Workday sensor', h.workday_sensor, this._inputHandler(['hdo', 'workday_sensor']))}
        </div>
      </details>
    `;
  }

  private _renderChannelEditor(ci: number, di: number, ch: DeviceChannel, chi: number): TemplateResult {
    return html`
      <div class="channel-editor">
        <div class="row-header">
          <span class="row-label">Channel ${chi + 1}: ${ch.name || '(unnamed)'}</span>
          <button class="btn-icon danger" @click=${() => this._removeChannel(ci, di, chi)} title="Remove channel">
            <ha-icon icon="mdi:minus-circle-outline"></ha-icon>
          </button>
        </div>
        ${this._textInput('Channel name', ch.name, this._channelInput(ci, di, chi, 'name'), 'e.g. Living room zone')}
        ${this._entityInput('Switch', ch.switch, this._channelInput(ci, di, chi, 'switch'))}
        ${this._entityInput('Power (W)', ch.power, this._channelInput(ci, di, chi, 'power'))}
        ${this._entityInput('Current (A)', ch.current, this._channelInput(ci, di, chi, 'current'))}
      </div>
    `;
  }

  private _renderDeviceEditor(ci: number, d: CircuitDevice, di: number): TemplateResult {
    const isOpen = this._openDevice === di;
    return html`
      <div class="device-item ${isOpen ? 'open' : ''}">
        <div class="row-header" @click=${() => { this._openDevice = isOpen ? -1 : di; }}>
          <span class="row-label">${d.name || '(unnamed device)'}</span>
          <div class="row-actions" @click=${(e: Event) => e.stopPropagation()}>
            <button class="btn-icon danger" @click=${() => this._removeDevice(ci, di)} title="Remove device">
              <ha-icon icon="mdi:minus-circle-outline"></ha-icon>
            </button>
          </div>
          <ha-icon icon="${isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}" class="chevron"></ha-icon>
        </div>
        ${isOpen ? html`
          <div class="device-fields">
            ${this._textInput('Device name', d.name, this._deviceInput(ci, di, 'name'), 'e.g. Washing machine')}
            ${this._entityInput('Switch', d.switch, this._deviceInput(ci, di, 'switch'))}
            ${this._entityInput('Power (W)', d.power, this._deviceInput(ci, di, 'power'))}
            ${this._entityInput('Current (A)', d.current, this._deviceInput(ci, di, 'current'))}

            <div class="field-group-label" style="margin-top:10px;">
              Channels (for multi-relay devices like Shelly 4PM)
            </div>
            ${(d.channels ?? []).map((ch, chi) => this._renderChannelEditor(ci, di, ch, chi))}
            <button class="btn-add" @click=${() => this._addChannel(ci, di)}>
              <ha-icon icon="mdi:plus"></ha-icon> Add channel
            </button>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderCircuitEditor(c: Circuit, idx: number): TemplateResult {
    const isOpen = this._openCircuit === idx;
    const total = (this._config.circuits?.length ?? 0);
    return html`
      <div class="circuit-item ${isOpen ? 'open' : ''}">
        <div class="row-header" @click=${() => {
          this._openCircuit = isOpen ? -1 : idx;
          this._openDevice = -1;
        }}>
          <span class="row-label">${c.name || '(unnamed circuit)'}</span>
          <div class="row-badges">
            ${c.phases === 3 ? html`<span class="badge info">3φ</span>` : nothing}
            ${c.critical ? html`<span class="badge warn">critical</span>` : nothing}
          </div>
          <div class="row-actions" @click=${(e: Event) => e.stopPropagation()}>
            ${idx > 0
              ? html`<button class="btn-icon" @click=${() => this._moveCircuit(idx, -1)} title="Move up">
                  <ha-icon icon="mdi:arrow-up"></ha-icon></button>`
              : nothing}
            ${idx < total - 1
              ? html`<button class="btn-icon" @click=${() => this._moveCircuit(idx, 1)} title="Move down">
                  <ha-icon icon="mdi:arrow-down"></ha-icon></button>`
              : nothing}
            <button class="btn-icon danger" @click=${() => this._removeCircuit(idx)} title="Remove circuit">
              <ha-icon icon="mdi:minus-circle-outline"></ha-icon>
            </button>
          </div>
          <ha-icon icon="${isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}" class="chevron"></ha-icon>
        </div>

        ${isOpen ? html`
          <div class="circuit-fields">
            ${this._textInput('Circuit name', c.name, this._circuitInput(idx, 'name'), 'e.g. Kitchen left')}
            ${this._textInput('Circuit ID', c.id, this._circuitInput(idx, 'id'), 'e.g. c08')}

            <div class="field inline">
              <label>Phases</label>
              <select @change=${this._circuitInput(idx, 'phases')}>
                <option value="1" ?selected=${c.phases !== 3}>1 (single-phase)</option>
                <option value="3" ?selected=${c.phases === 3}>3 (three-phase)</option>
              </select>
            </div>

            <div class="field inline checkbox">
              <input type="checkbox" id="crit-${idx}" ?checked=${c.critical ?? false}
                @change=${this._circuitCheck(idx, 'critical')} />
              <label for="crit-${idx}">Critical circuit (disables remote toggle)</label>
            </div>

            ${this._numberInput('Max current (A)', c.max_current, this._circuitInput(idx, 'max_current'), c.phases === 3 ? '63' : '16')}

            <div class="field-group-label" style="margin-top:10px;">Breaker entities</div>
            ${this._entityInput('Switch', c.switch, this._circuitInput(idx, 'switch'))}
            ${this._entityInput('Power (W)', c.power, this._circuitInput(idx, 'power'))}
            ${this._entityInput('Current (A)', c.current, this._circuitInput(idx, 'current'))}
            ${this._entityInput('Energy today (kWh)', c.energy, this._circuitInput(idx, 'energy'))}
            ${this._entityInput('Voltage (V)', c.voltage, this._circuitInput(idx, 'voltage'))}

            <div class="field-group-label" style="margin-top:10px;">
              Devices behind this breaker
            </div>
            ${(c.devices ?? []).map((d, di) => this._renderDeviceEditor(idx, d, di))}
            <button class="btn-add" @click=${() => this._addDevice(idx)}>
              <ha-icon icon="mdi:plus"></ha-icon> Add device
            </button>
          </div>
        ` : nothing}
      </div>
    `;
  }

  // ── Main render ────────────────────────────────────────────────────────────

  render(): TemplateResult {
    if (!this._config) return html``;

    return html`
      <datalist id="ep-entities"></datalist>

      <div class="editor">
        ${this._textInput(
          'Card title (optional)',
          this._config.title,
          this._inputHandler(['title']),
          'Electricity panel'
        )}

        ${this._renderMainMeterSection()}
        ${this._renderHdoSection()}

        <div class="section-header">Circuits</div>
        ${(this._config.circuits ?? []).map((c, i) => this._renderCircuitEditor(c, i))}
        <button class="btn-add primary" @click=${this._addCircuit}>
          <ha-icon icon="mdi:plus-circle-outline"></ha-icon> Add circuit
        </button>
      </div>
    `;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  static styles = css`
    :host { display: block; }

    .editor { padding: 4px 0 8px; }

    /* Generic field */
    .field {
      margin-bottom: 8px;
    }
    .field label {
      display: block;
      font-size: 12px;
      color: var(--secondary-text-color);
      margin-bottom: 3px;
    }
    .field input[type="text"],
    .field input[type="number"],
    .field input:not([type]) {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--divider-color, rgba(0,0,0,0.15));
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-size: 13px;
    }
    .field select {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--divider-color, rgba(0,0,0,0.15));
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-size: 13px;
      cursor: pointer;
    }
    .field.inline { display: flex; align-items: center; gap: 10px; }
    .field.inline label { margin: 0; white-space: nowrap; }
    .field.checkbox { flex-direction: row-reverse; justify-content: flex-end; gap: 8px; }
    .field.checkbox label { font-size: 13px; color: var(--primary-text-color); cursor: pointer; }
    .field.checkbox input { width: auto; }

    .field-group-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--disabled-text-color);
      margin-bottom: 6px;
    }

    /* Sections (main meter, hdo) */
    details.section {
      border: 1px solid var(--divider-color, rgba(0,0,0,0.1));
      border-radius: 8px;
      margin-bottom: 8px;
    }
    details.section > summary {
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--primary-text-color);
      cursor: pointer;
      user-select: none;
      list-style: none;
    }
    details.section > summary::-webkit-details-marker { display: none; }
    .section-body { padding: 4px 12px 12px; }

    /* Section header for circuits */
    .section-header {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--secondary-text-color);
      margin: 12px 0 6px;
    }

    /* Circuit / device items */
    .circuit-item,
    .device-item {
      border: 1px solid var(--divider-color, rgba(0,0,0,0.1));
      border-radius: 8px;
      margin-bottom: 6px;
      overflow: hidden;
    }
    .circuit-item.open,
    .device-item.open {
      border-color: var(--primary-color, #2196f3);
    }

    .row-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 12px;
      cursor: pointer;
      user-select: none;
    }
    .row-header:hover { background: var(--secondary-background-color); }

    .row-label {
      flex: 1;
      font-size: 13px;
      color: var(--primary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-badges { display: flex; gap: 4px; flex-shrink: 0; }
    .row-actions { display: flex; gap: 2px; flex-shrink: 0; }
    .chevron { --mdc-icon-size: 18px; color: var(--secondary-text-color); flex-shrink: 0; }

    .circuit-fields,
    .device-fields { padding: 4px 12px 12px; }

    /* Channel editor */
    .channel-editor {
      border: 1px solid var(--divider-color, rgba(0,0,0,0.08));
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 6px;
    }

    /* Badges */
    .badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
    }
    .badge.info { background: rgba(33,150,243,0.12); color: var(--primary-color, #2196f3); }
    .badge.warn { background: rgba(245,124,0,0.12); color: var(--warning-color, #f57c00); }

    /* Buttons */
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--secondary-text-color);
      padding: 2px;
      border-radius: 4px;
      display: flex;
      align-items: center;
    }
    .btn-icon:hover { background: var(--secondary-background-color); }
    .btn-icon.danger:hover { color: var(--error-color, #e53935); }
    .btn-icon ha-icon { --mdc-icon-size: 18px; }

    .btn-add {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: 1px dashed var(--divider-color, rgba(0,0,0,0.2));
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 13px;
      color: var(--secondary-text-color);
      cursor: pointer;
      width: 100%;
      margin-top: 4px;
    }
    .btn-add:hover { background: var(--secondary-background-color); }
    .btn-add.primary {
      border-color: var(--primary-color, #2196f3);
      color: var(--primary-color, #2196f3);
      margin-top: 8px;
    }
    .btn-add ha-icon { --mdc-icon-size: 18px; }
  `;
}
