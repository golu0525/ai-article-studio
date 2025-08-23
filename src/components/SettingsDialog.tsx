import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

export type Provider = "openai" | "gemini";

const LOCAL_KEYS = {
  provider: "ai_provider",
  openai: "openai_api_key",
  gemini: "gemini_api_key",
  storeMode: "ai_store_mode", // "local" | "session"
} as const;

export function getStoredProvider(): Provider {
  const p = (localStorage.getItem(LOCAL_KEYS.provider) || "openai") as Provider;
  return p === "gemini" ? "gemini" : "openai";
}

export function getApiKey(provider: Provider): string | null {
  const mode = (localStorage.getItem(LOCAL_KEYS.storeMode) || "local") as "local" | "session";
  const storage = mode === "session" ? sessionStorage : localStorage;
  return storage.getItem(provider === "openai" ? LOCAL_KEYS.openai : LOCAL_KEYS.gemini);
}

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [storeMode, setStoreMode] = useState<"local" | "session">("local");

  useEffect(() => {
    setProvider(getStoredProvider());
    const mode = (localStorage.getItem(LOCAL_KEYS.storeMode) || "local") as "local" | "session";
    setStoreMode(mode);
    const storage = mode === "session" ? sessionStorage : localStorage;
    setOpenaiKey(storage.getItem(LOCAL_KEYS.openai) || "");
    setGeminiKey(storage.getItem(LOCAL_KEYS.gemini) || "");
  }, []);

  const onSave = () => {
    // Persist provider and storage mode
    localStorage.setItem(LOCAL_KEYS.provider, provider);
    localStorage.setItem(LOCAL_KEYS.storeMode, storeMode);

    const target = storeMode === "session" ? sessionStorage : localStorage;
    const other = storeMode === "session" ? localStorage : sessionStorage;

    // Save in selected storage
    if (openaiKey) target.setItem(LOCAL_KEYS.openai, openaiKey);
    else target.removeItem(LOCAL_KEYS.openai);
    if (geminiKey) target.setItem(LOCAL_KEYS.gemini, geminiKey);
    else target.removeItem(LOCAL_KEYS.gemini);

    // Clear from the other storage to avoid leftovers
    other.removeItem(LOCAL_KEYS.openai);
    other.removeItem(LOCAL_KEYS.gemini);

    toast.success(storeMode === "session" ? "Saved to this session only." : "Settings saved on this device.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Open settings">
          <Settings2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            Keys are stored on your device. For best security, use session-only storage or move API calls to a secure backend (Supabase Edge Functions).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger id="provider" aria-label="Select AI provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Session-only storage</div>
              <p className="text-xs text-muted-foreground">Do not persist API keys; clear on tab close.</p>
            </div>
            <Switch
              checked={storeMode === "session"}
              onCheckedChange={(val) => setStoreMode(val ? "session" : "local")}
              aria-label="Toggle session-only storage"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai">OpenAI API Key</Label>
            <Input
              id="openai"
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini">Gemini API Key</Label>
            <Input
              id="gemini"
              type="password"
              placeholder="AIza..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={onSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
