import { useEffect, useState } from "react";
import { useAudioContext } from "@/audio";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Settings, and only the ones that are real.
 *
 * Sample rate, latency and output device are all fixed for the life of an
 * AudioContext, so every one of them means tearing the engine down and building
 * it again. The panel says that rather than pretending a knob turn is enough —
 * a setting that silently does nothing is worse than one that is not offered.
 *
 * Buffer size is deliberately absent. An AudioWorklet always renders 128 frames
 * and there is no way to change it; what you can actually ask for is a latency
 * *category*, and that is what is here.
 */
export function Settings() {
  const sound = useAudioContext();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const read = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === "audiooutput")))
        .catch(() => {});
    read();
    navigator.mediaDevices.addEventListener("devicechange", read);
    return () => navigator.mediaDevices.removeEventListener("devicechange", read);
  }, []);

  const apply = async (next: Parameters<typeof sound.restart>[0]) => {
    setBusy(true);
    await sound.restart(next);
    setBusy(false);
  };

  const actual = sound.actual;

  return (
    <div className="space-y-4 px-1 py-2">
      <Group title="Output">
        {devices.length === 0 ? (
          <p className="text-muted-foreground text-[11px] leading-[1.5]">
            No devices listed. Browsers withhold the list until something has asked for audio
            permission — the default output is being used.
          </p>
        ) : (
          <div className="space-y-1">
            {devices.map((d, i) => (
              <button
                key={d.deviceId || i}
                disabled={busy}
                onClick={() => apply({ sinkId: d.deviceId })}
                className={`w-full truncate rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors ${
                  sound.options.sinkId === d.deviceId
                    ? "border-accent-blue bg-card"
                    : "border-card-border bg-card-alpha hover:border-card-border-hover"
                }`}
              >
                {/* Labels need microphone permission, which we have not asked
                    for and do not need. An unnamed device is still selectable. */}
                {d.label || `Output ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </Group>

      <Group title="Sample rate">
        <ToggleGroup
          type="single"
          size="sm"
          value={String(sound.options.sampleRate ?? 0)}
          onValueChange={(v) => v && apply({ sampleRate: Number(v) || undefined })}
          className="w-full"
        >
          <ToggleGroupItem value="0">Auto</ToggleGroupItem>
          <ToggleGroupItem value="44100">44.1k</ToggleGroupItem>
          <ToggleGroupItem value="48000">48k</ToggleGroupItem>
          <ToggleGroupItem value="96000">96k</ToggleGroupItem>
        </ToggleGroup>
        <Note>A request, not an instruction — the device grants what it can.</Note>
      </Group>

      <Group title="Latency">
        <ToggleGroup
          type="single"
          size="sm"
          value={sound.options.latencyHint}
          onValueChange={(v) => v && apply({ latencyHint: v as AudioContextLatencyCategory })}
          className="w-full"
        >
          <ToggleGroupItem value="interactive">Low</ToggleGroupItem>
          <ToggleGroupItem value="balanced">Balanced</ToggleGroupItem>
          <ToggleGroupItem value="playback">Safe</ToggleGroupItem>
        </ToggleGroup>
        <Note>Low is for playing, Safe is for a machine that is struggling.</Note>
      </Group>

      <Group title="Actual">
        {/* What the device gave, not what was asked for. The gap between the
            two is the whole reason to show it. */}
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10px]">
          <dt>RATE</dt>
          <dd className="text-foreground text-right">{actual.sampleRate ? `${(actual.sampleRate / 1000).toFixed(1)}k` : "—"}</dd>
          <dt>LATENCY</dt>
          <dd className="text-foreground text-right">{actual.latencyMs ? `${actual.latencyMs}ms` : "—"}</dd>
          <dt>QUANTUM</dt>
          <dd className="text-foreground text-right">128</dd>
          <dt>VOICES</dt>
          <dd className="text-foreground text-right">{sound.status.voices}/8</dd>
          <dt>STATE</dt>
          <dd className="text-foreground text-right">{actual.state}</dd>
        </dl>
      </Group>

      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        className="w-full font-mono text-[10px] tracking-wider uppercase"
        onClick={() => apply({})}
      >
        {busy ? "Restarting…" : "Restart audio"}
      </Button>

      <p className="text-muted-foreground text-[11px] leading-[1.5]">
        Every setting here rebuilds the engine — none of them can change on a running context. Your
        instrument goes back across afterwards; the only thing lost is whatever was ringing.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <Label className="mb-1.5">{title}</Label>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-1.5 text-[10px] leading-[1.5]">{children}</p>;
}
