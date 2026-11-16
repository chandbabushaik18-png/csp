import React, { useState } from 'react';
import {
  Cpu,
  WifiOff,
  Wifi,
  Power,
  Droplets,
  Thermometer,
  Wind,
  AlertCircle,
  Terminal,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { IotDeviceStatus, Language } from '../types';
import { DataProvenanceBadge } from './DataProvenanceBadge';

interface IotHardwareSectionProps {
  currentLang: Language;
  iotStatus: IotDeviceStatus | null;
  onRefreshStatus: () => Promise<void>;
  onNotify: (title: string, description?: string, variant?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const IotHardwareSection: React.FC<IotHardwareSectionProps> = ({
  iotStatus,
  onRefreshStatus,
  onNotify,
}) => {
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simMoisture, setSimMoisture] = useState(44);
  const [simTemp, setSimTemp] = useState(29.4);
  const [simHumidity, setSimHumidity] = useState(64);
  const [simPumpActive, setSimPumpActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const isConnected = Boolean(iotStatus?.connected && iotStatus.latestTelemetry);

  const displayedMoisture = isConnected
    ? iotStatus!.latestTelemetry!.soilMoisturePercent
    : simulationEnabled
    ? simMoisture
    : null;

  const displayedTemp = isConnected
    ? iotStatus!.latestTelemetry!.temperatureC
    : simulationEnabled
    ? simTemp
    : null;

  const displayedHumidity = isConnected
    ? iotStatus!.latestTelemetry!.humidityPercent
    : simulationEnabled
    ? simHumidity
    : null;

  const displayedPump = isConnected
    ? iotStatus!.pumpRelayActive
    : simulationEnabled
    ? simPumpActive
    : false;

  const handleTogglePump = async () => {
    if (!isConnected && !simulationEnabled) {
      onNotify(
        'ESP32 Device Offline',
        'Connect hardware or enable Simulation Mode to preview pump relay actuation.',
        'warning'
      );
      return;
    }

    setBusy(true);
    try {
      const nextAction = displayedPump ? 'OFF' : 'ON';
      const mode = isConnected ? 'hardware' : 'simulation';
      const res = await fetch('/api/iot/pump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction, mode }),
      });

      const data = await res.json();
      if (!res.ok) {
        onNotify('Relay Command Rejected', data.error || 'Hardware disconnected', 'error');
        return;
      }

      if (!isConnected && simulationEnabled) {
        setSimPumpActive(Boolean(data.pumpRelayActive));
      } else {
        await onRefreshStatus();
      }
      onNotify(
        `Pump Relay ${data.pumpRelayActive ? 'ON' : 'OFF'}`,
        data.message,
        isConnected ? 'success' : 'info'
      );
    } catch {
      onNotify('Connection Error', 'Failed to send pump relay command.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleTestWebhookIngest = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/iot/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'ESP32-AGRI-LAB-01',
          firmwareVersion: 'v2.4.1-capacitive',
          soilMoisturePercent: simMoisture,
          temperatureC: simTemp,
          humidityPercent: simHumidity,
          pumpRelayActive: simPumpActive,
          wifiRssiDbm: -62,
        }),
      });
      if (res.ok) {
        await onRefreshStatus();
        onNotify(
          'ESP32 Telemetry Packet Received',
          'Device heartbeat registered for 60 seconds on /api/iot/telemetry.',
          'success'
        );
      }
    } catch {
      onNotify('Webhook Test Failed', 'Could not post telemetry packet.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const espPayloadSnippet = `POST ${window.location.origin}/api/iot/telemetry
Content-Type: application/json

{
  "deviceId": "ESP32-FIELD-01",
  "firmwareVersion": "2.4.1",
  "soilMoisturePercent": 46,
  "temperatureC": 29.5,
  "humidityPercent": 62,
  "pumpRelayActive": false
}`;

  const handleCopySnippet = () => {
    navigator.clipboard?.writeText(espPayloadSnippet);
    onNotify('Copied Firmware Payload', 'HTTP POST endpoint and JSON schema copied.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header Glass Card */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#174C36]">
              <Cpu className="w-4 h-4 text-[#4D966B]" />
              <span>IoT Field Telemetry & Pump Relay</span>
            </span>
            {iotStatus?.provenance && <DataProvenanceBadge provenance={iotStatus.provenance} />}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#202820] font-display">
            ESP32 Soil Moisture & Irrigation Controller
          </h2>
          <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
            Capacitive Soil Moisture Sensor + DHT22 Microclimate Probe + 5V Optocoupler Relay Module. Hardware measurements appear only when a live ESP32 node checks in.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              isConnected
                ? 'bg-[#DDEDE2] text-[#174C36] border-[#4D966B]/30'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{isConnected ? 'ESP32 ONLINE' : 'DEVICE OFFLINE'}</span>
          </div>

          <button
            type="button"
            onClick={() => onRefreshStatus()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white border border-[#174C36]/15 text-[#202820] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Poll Status</span>
          </button>
        </div>
      </div>

      {/* Explicit Offline / Simulation Banner when Hardware Disconnected */}
      {!isConnected && (
        <div className="glass-panel rounded-[22px] p-5 border border-amber-300/60 bg-amber-50/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-[#202820] text-sm">
                ESP32 Hardware Gateway is Currently Offline
              </div>
              <p className="text-[#5D665E] mt-0.5 leading-relaxed">
                No heartbeat received on <span className="font-mono">/api/iot/telemetry</span> in the last 60s. Real measurements are withheld to preserve data integrity. You may activate <strong>Simulation Mode</strong> below to test thresholds and pump logic.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSimulationEnabled(!simulationEnabled)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              simulationEnabled
                ? 'bg-[#174C36] text-white shadow-sm'
                : 'bg-white text-[#202820] border border-[#174C36]/20 hover:bg-[#DDEDE2]/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{simulationEnabled ? 'Simulation Mode: ON' : 'Enable Simulation Mode'}</span>
          </button>
        </div>
      )}

      {/* Telemetry Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Soil Moisture */}
        <div className="glass-panel rounded-[22px] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#858D86] font-semibold">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-[#4D966B]" />
              <span>Capacitive Soil Moisture</span>
            </span>
            <span className="font-mono text-[10px]">
              {isConnected ? 'LIVE ADC' : simulationEnabled ? 'DEMO SIM' : 'OFFLINE'}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#202820] font-display tabular-nums">
              {displayedMoisture !== null ? `${displayedMoisture}%` : '-- %'}
            </div>
            <div className="w-full h-2 rounded-full bg-[#174C36]/10 mt-3 overflow-hidden">
              <div
                className="h-full bg-[#4D966B] rounded-full transition-all duration-300"
                style={{ width: `${displayedMoisture ?? 0}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-[#858D86] mt-3">
            {displayedMoisture === null
              ? 'Awaiting ESP32 sensor packet'
              : displayedMoisture < 35
              ? 'Dry root zone — Irrigation triggered'
              : displayedMoisture > 72
              ? 'Field capacity reached'
              : 'Optimal vegetative moisture'}
          </div>
        </div>

        {/* DHT22 Canopy Temperature */}
        <div className="glass-panel rounded-[22px] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#858D86] font-semibold">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-[#174C36]" />
              <span>DHT22 Canopy Temp</span>
            </span>
            <span className="font-mono text-[10px]">
              {isConnected ? 'LIVE' : simulationEnabled ? 'DEMO SIM' : 'OFFLINE'}
            </span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-[#202820] font-display tabular-nums">
            {displayedTemp !== null ? `${displayedTemp}°C` : '-- °C'}
          </div>
          <div className="text-[11px] text-[#858D86] mt-3">
            Field-level microclimate thermistor
          </div>
        </div>

        {/* DHT22 Relative Humidity */}
        <div className="glass-panel rounded-[22px] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#858D86] font-semibold">
            <span className="flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-[#4D966B]" />
              <span>DHT22 Air Humidity</span>
            </span>
            <span className="font-mono text-[10px]">
              {isConnected ? 'LIVE' : simulationEnabled ? 'DEMO SIM' : 'OFFLINE'}
            </span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-[#202820] font-display tabular-nums">
            {displayedHumidity !== null ? `${displayedHumidity}%` : '-- %'}
          </div>
          <div className="text-[11px] text-[#858D86] mt-3">
            Canopy transpiration vapor pressure gauge
          </div>
        </div>

        {/* Relay Pump Control */}
        <div className="glass-panel rounded-[22px] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#858D86] font-semibold">
            <span className="flex items-center gap-1.5">
              <Power className="w-4 h-4 text-[#174C36]" />
              <span>Irrigation Pump Relay</span>
            </span>
            <span className="font-mono text-[10px]">
              {displayedPump ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xl font-bold text-[#202820] font-display">
              {!isConnected && !simulationEnabled
                ? 'Locked'
                : displayedPump
                ? 'Motor ON'
                : 'Motor OFF'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={handleTogglePump}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                displayedPump
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#174C36] hover:bg-[#113A29] text-white'
              } disabled:opacity-50`}
            >
              {displayedPump ? 'Stop Pump' : 'Start Pump'}
            </button>
          </div>
          <div className="text-[11px] text-[#858D86] mt-3">
            {isConnected ? 'GPIO-26 Relay Actuator' : simulationEnabled ? 'Simulated Relay Switch' : 'Requires live ESP32 or Simulation'}
          </div>
        </div>
      </div>

      {/* Simulation Controls (Only visible if user opted in while offline) */}
      {!isConnected && simulationEnabled && (
        <div className="glass-panel rounded-[24px] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#202820] font-display">
                Interactive IoT Sensor Sandbox (DEMO / SIMULATION MODE)
              </h3>
              <p className="text-xs text-[#858D86]">
                Adjust simulated sensor values or dispatch a real test packet to the backend telemetry endpoint.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleTestWebhookIngest}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#DDEDE2] hover:bg-[#cbe3d2] text-[#174C36] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Send Live HTTP Test Packet to /api/iot/telemetry</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-[#202820] mb-2">
                <span>Simulated Soil Moisture</span>
                <span className="font-mono">{simMoisture}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={95}
                value={simMoisture}
                onChange={(e) => setSimMoisture(Number(e.target.value))}
                className="w-full accent-[#174C36] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#202820] mb-2">
                <span>Simulated DHT22 Temp</span>
                <span className="font-mono">{simTemp}°C</span>
              </div>
              <input
                type="range"
                min={14}
                max={46}
                step={0.5}
                value={simTemp}
                onChange={(e) => setSimTemp(Number(e.target.value))}
                className="w-full accent-[#4D966B] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#202820] mb-2">
                <span>Simulated Humidity</span>
                <span className="font-mono">{simHumidity}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={98}
                value={simHumidity}
                onChange={(e) => setSimHumidity(Number(e.target.value))}
                className="w-full accent-[#174C36] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hardware Architecture & Firmware Integration Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 glass-panel rounded-[24px] p-6 space-y-4">
          <div className="h-44 rounded-2xl overflow-hidden bg-[#174C36]/10">
            <img
              src="/src/assets/images/smart_farmland_sensor_iot_1794070590682.jpg"
              alt="Field IoT Soil Moisture Sensor Node"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-2 text-xs">
            <h3 className="text-sm font-bold text-[#202820] font-display">
              Supported Field Hardware Stack
            </h3>
            <ul className="space-y-1.5 text-[#5D665E]">
              <li>· <strong>MCU</strong>: ESP32-WROOM-32 Dual-Core Wi-Fi / BLE</li>
              <li>· <strong>Soil Probe</strong>: Capacitive v1.2 Corrosion-Resistant (GPIO 34 ADC)</li>
              <li>· <strong>Microclimate</strong>: DHT22 Digital Temp & RH Sensor (GPIO 4)</li>
              <li>· <strong>Actuator</strong>: 5V 10A Optocoupler Relay for 3-Phase Starter (GPIO 26)</li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-7 glass-panel rounded-[24px] p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#202820]">
              <Terminal className="w-4 h-4 text-[#174C36]" />
              <span>ESP32 REST Telemetry Ingestion Endpoint</span>
            </div>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white/80 hover:bg-white border border-[#174C36]/15 text-[#174C36] flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Copy Schema</span>
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-[#16231C] text-[#DDEDE2] font-mono text-[11px] leading-relaxed overflow-x-auto">
            {espPayloadSnippet}
          </pre>

          <div className="text-[11px] text-[#858D86]">
            The backend marks your node <strong>ONLINE</strong> automatically for {iotStatus?.timeoutSeconds ?? 60} seconds after each valid POST packet and syncs pump relay targets in the JSON response.
          </div>
        </div>
      </div>
    </div>
  );
};
