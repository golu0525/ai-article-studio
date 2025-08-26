import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsDialog, { Provider, getApiKey, getStoredProvider } from "@/components/SettingsDialog";
import { Copy, FileText, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

const LENGTH_PRESETS: Record<string, number> = {
  short: 300,
  medium: 700,
  long: 1200,
};

const MAX_TEXT = 12000;

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional content writer." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    } as RequestInit);
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim?.() || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      }
    );
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function tryFetchUrlContent(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(u.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      redirect: "follow",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
    return text.replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}

const Index = () => {
  const [provider, setProvider] = useState<Provider>("openai");

  // Generator state
  const [topic, setTopic] = useState("");
  const [length, setLength] = useState<string>("medium");
  const [article, setArticle] = useState("");
  const [generating, setGenerating] = useState(false);

  // Summarizer state
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    const p = getStoredProvider();
    setProvider(p);
  }, []);

  const providerKey = useMemo(() => getApiKey(provider), [provider]);

  const ensureKey = () => {
    if (!providerKey) {
      toast.error("Add your API key in Settings (top right).");
      return false;
    }
    return true;
  };

  const onGenerate = async () => {
    const cleanTopic = topic.replace(/\s+/g, " ").trim();
    if (!cleanTopic) return toast.error("Please enter a topic or keyword.");
    if (cleanTopic.length > 120) return toast.error("Topic is too long (max 120 characters).");
    if (!ensureKey()) return;
    setGenerating(true);
    setArticle("");
    try {
      const words = LENGTH_PRESETS[length] ?? LENGTH_PRESETS.medium;
      const prompt = `Write an informative, SEO-friendly article about "${cleanTopic}" in about ${words} words. Use clear headings and short paragraphs. End with a brief conclusion.`;
      const text = provider === "openai" ? await callOpenAI(providerKey!, prompt) : await callGemini(providerKey!, prompt);
      setArticle(text);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const onSummarize = async () => {
    if (!ensureKey()) return;
    let text = sourceText.trim();

    if (!text && sourceUrl.trim()) {
      try {
        const u = new URL(sourceUrl.trim());
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        return toast.error("Enter a valid http(s) URL.");
      }
      const fetched = await tryFetchUrlContent(sourceUrl.trim());
      if (!fetched) {
        return toast.error("Could not fetch URL (CORS). Please paste the article text.");
      }
      text = fetched;
    }

    if (!text) return toast.error("Paste text or provide a URL.");

    if (text.length > MAX_TEXT) {
      text = text.slice(0, MAX_TEXT);
      toast.warning("Input truncated to prevent oversized requests.");
    }

    setSummarizing(true);
    setSummary("");
    try {
      const prompt = `Summarize the following article in a concise, clear, bullet-point format under 150 words.\n\nArticle:\n${text}`;
      const result = provider === "openai" ? await callOpenAI(providerKey!, prompt) : await callGemini(providerKey!, prompt);
      setSummary(result);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  const copy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen hero-surface">
      <header className="container mx-auto flex items-center justify-between py-8">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">AI Article Generator & Summarizer</h1>
          <p className="text-muted-foreground max-w-2xl">
            Generate SEO-friendly articles and concise summaries using OpenAI or Gemini.
          </p>
        </div>
        <SettingsDialog />
      </header>

      <main className="container mx-auto pb-16">
        <Tabs defaultValue="generator" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="generator" className="gap-2"><Sparkles className="size-4" /> Generator</TabsTrigger>
            <TabsTrigger value="summarizer" className="gap-2"><Wand2 className="size-4" /> Summarizer</TabsTrigger>
          </TabsList>

          <TabsContent value="generator">
            <Card>
              <CardHeader>
                <CardTitle>Article Generator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                  <Input
                    placeholder="Enter a topic or keyword (e.g., Sustainable Travel)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    aria-label="Topic or keyword"
                    maxLength={120}
                  />
                  <Select value={length} onValueChange={setLength}>
                    <SelectTrigger aria-label="Select article length">
                      <SelectValue placeholder="Length" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (~300 words)</SelectItem>
                      <SelectItem value="medium">Medium (~700 words)</SelectItem>
                      <SelectItem value="long">Long (~1200 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button onClick={onGenerate} disabled={generating} variant="hero">
                    <Sparkles className="size-4" /> {generating ? "Generating..." : "Generate Article"}
                  </Button>
                </div>

                <div aria-live="polite" className="mt-2">
                  {article ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="size-4" /> Generated Article
                        </div>
                        <Button variant="outline" size="sm" onClick={() => copy(article)}>
                          <Copy className="size-4" /> Copy
                        </Button>
                      </div>
                      <div className="max-h-[480px] overflow-auto rounded-md border p-4 leading-relaxed space-y-3">
                        {article.split("\n").map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ) : generating ? (
                    <div className="h-40 w-full animate-pulse rounded-md border bg-muted/30" />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summarizer">
            <Card>
              <CardHeader>
                <CardTitle>Article Summarizer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4"> {/*md:grid-cols-2*/}
                  <Textarea
                    placeholder="Paste article text here..."
                    className="min-h-40"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    aria-label="Article text"
                    maxLength={MAX_TEXT}
                  />
                  {/* <div className="space-y-2">
                    <Input
                      placeholder="Or paste article URL (may be blocked by CORS)"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      aria-label="Article URL"
                      type="url"
                      maxLength={2048}
                    />
                    <p className="text-xs text-muted-foreground">Tip: If URL fetch fails, paste the article text instead.</p>
                  </div> */}
                </div>
                <div className="flex gap-3">
                  <Button onClick={onSummarize} disabled={summarizing} variant="brand">
                    <Wand2 className="size-4" /> {summarizing ? "Summarizing..." : "Summarize"}
                  </Button>
                </div>

                <div aria-live="polite" className="mt-2">
                  {summary ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="size-4" /> Summary
                        </div>
                        <Button variant="outline" size="sm" onClick={() => copy(summary)}>
                          <Copy className="size-4" /> Copy
                        </Button>
                      </div>
                      <div className="max-h-[320px] overflow-auto rounded-md border p-4 leading-relaxed space-y-3">
                        {summary.split("\n").map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ) : summarizing ? (
                    <div className="h-32 w-full animate-pulse rounded-md border bg-muted/30" />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;