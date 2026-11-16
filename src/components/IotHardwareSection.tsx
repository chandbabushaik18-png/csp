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
  Copy,
} from 'lucide-react';
import { IotDeviceStatus, Language } from '../types';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { safeFetchJson } from '../utils/safeFetchJson';

interface IotHardwareSectionProps {
  currentLang: Language;
  iotStatus: IotDeviceStatus | null;
  onRefreshStatus: () => Promise<void>;
  onNotify: (
    title: string,
    description?: string,
    variant?: 'success' | 'info' | 'warning' | 'error'
  ) => void;
}

export const IotHardwareSection: React.FC<IotHardwareSectionProps> = ({
  iotStatus,
  onRefreshStatus,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);

  const isConnected = Boolean(iotStatus?.connected && iotStatus.latestTelemetry);
  const displayedMoisture = isConnected ? iotStatus!.latestTelemetry!.soilMoisturePercent : null;
  const displayedTemp = isConnected ? iotStatus!.latestTelemetry!.temperatureC : null;
  const displayedHumidity = isConnected ? iotStatus!.latestTelemetry!.humidityPercent : null;
  const displayedPump = isConnected ? iotStatus!.pumpRelayActive : false;

  const handleTogglePump = async () => {
    if (!isConnected) {
      onNotify(
        'ESP32 Device Not Connected',
        'Pump relay actuation requires an active ESP32 telemetry connection.',
        'warning'
      );
      return;
    }

    setBusy(true);
    try {
      const nextAction = displayedPump ? 'OFF' : 'ON';
      const res = await safeFetchJson<any>('/api/iot/pump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      });

      const data = res.data;
      if (!res.ok) {
        onNotify('Relay Command Rejected', data?.error || 'ESP32 device is not connected.', 'error');
        return;
      }

      await onRefreshStatus();
      onNotify(
        `Pump Relay ${data?.pumpRelayActive ? 'ON' : 'OFF'}`,
        data?.message || 'Relay target updated for connected ESP32 hardware.',
        'success'
      );
    } catch {
      onNotify('Connection Error', 'Failed to send pump relay command.', 'error');
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
    <div className="space-y-6 pb-8">
      {/* Header Glass Card */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#174C36]">
              <Cpu className="w-4 h-4 text-[#4D966B]" />
              <span>IoT Field Hardware & Telemetry</span>
            </span>
            {iotStatus?.provenance && (
              <DataProvenanceBadge
                provenance={iotStatus.provenance}
                integrityState={iotStatus.integrityState}
              />
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#202820] font-display">
            ESP32 Soil Moisture & Irrigation Controller
          </h2>
          <p className="text-xs sm:text-sm text-[#858D86] mt-1 max-w-2xl">
            Live sensor telemetry and pump relay state appear only when a physical ESP32 microcontroller checks in over <span className="font-mono">/api/iot/telemetry</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              isConnected
                ? 'bg-[#DDEDE2] text-[#174C36] border-[#4D966B]/30'
                : 'bg-white/85 text-[#5D665E] border-[#858D86]/25'
            }`}
          >
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>{isConnected ? 'LIVE DATA · CONNECTED' : 'NO DATA · NOT CONNECTED'}</span>
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

      {/* Disconnected Hardware Notice */}
      {!isConnected && (
        <div className="glass-panel rounded-[22px] p-5 border border-[#858D86]/25 bg-white/75 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#5D665E] shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-[#202820] text-sm">
              ESP32 device is not connected.
            </div>
            <p className="text-[#5D665E] mt-0.5 leading-relaxed">
              No hardware telemetry packets have been received within the last {iotStatus?.timeoutSeconds ?? 60} seconds. Sensor values and pump relay controls remain locked until real ESP32 hardware connects.
            </p>
          </div>
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
            <span className="font-mono text-[10px]">{isConnected ? 'LIVE DATA' : 'NO DATA'}</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#202820] font-display tabular-nums">
              {displayedMoisture !== null ? `${displayedMoisture}%` : 'No Data'}
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
              ? 'ESP32 device not connected'
              : displayedMoisture < 35
              ? 'Dry root zone — Irrigation recommended'
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
            <span className="font-mono text-[10px]">{isConnected ? 'LIVE DATA' : 'NO DATA'}</span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-[#202820] font-display tabular-nums">
            {displayedTemp !== null ? `${displayedTemp}°C` : 'No Data'}
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
            <span className="font-mono text-[10px]">{isConnected ? 'LIVE DATA' : 'NO DATA'}</span>
          </div>
          <div className="mt-4 text-3xl font-extrabold text-[#202820] font-display tabular-nums">
            {displayedHumidity !== null ? `${displayedHumidity}%` : 'No Data'}
          </div>
          <div className="text-[11px] text-[#858D86] mt-3">
            Canopy transpiration vapor gauge
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
              {isConnected ? (displayedPump ? 'ACTIVE' : 'STANDBY') : 'NO DATA'}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xl font-bold text-[#202820] font-display">
              {!isConnected ? 'Locked' : displayedPump ? 'Motor ON' : 'Motor OFF'}
            </span>
            <button
              type="button"
              disabled={busy || !isConnected}
              onClick={handleTogglePump}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                displayedPump
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#174C36] hover:bg-[#113A29] text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {displayedPump ? 'Stop Pump' : 'Start Pump'}
            </button>
          </div>
          <div className="text-[11px] text-[#858D86] mt-3">
            {isConnected ? 'GPIO-26 Relay Actuator' : 'Requires live ESP32 hardware'}
          </div>
        </div>
      </div>

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
              <li>· <strong>Soil Probe</strong>: Capacitive v1.2 (GPIO 34 ADC)</li>
              <li>· <strong>Microclimate</strong>: DHT22 Digital Temp & RH Sensor (GPIO 4)</li>
              <li>· <strong>Actuator</strong>: 5V 10A Optocoupler Relay Module (GPIO 26)</li>
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
            The backend marks your node <strong>LIVE DATA</strong> for {iotStatus?.timeoutSeconds ?? 60} seconds after each valid hardware POST packet and returns desired relay states in the JSON response.
          </div>
        </div>
      </div>
    </div>
  );
};
