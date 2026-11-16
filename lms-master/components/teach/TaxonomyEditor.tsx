"use client";
import { useEffect, useState } from "react";
import { Check, Plus, Save } from "lucide-react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { btn, button, Card, Flash, input, Msg } from "@/components/ui";

type Item = { id: string; name: string };

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
      }`}
    >
      {on && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

export default function TaxonomyEditor({ courseId }: { courseId: string }) {
  const cats = useApi<Item[]>("/categories");
  const tags = useApi<Item[]>("/tags");
  const cur = useApi<{ categories: Item[]; tags: Item[] }>(`/courses/${courseId}/taxonomy`);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [selTags, setSelTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (cur.data) {
      setSelCats(cur.data.categories.map((c) => c.id)); // eslint-disable-line react-hooks/set-state-in-effect
      setSelTags(cur.data.tags.map((t) => t.id));
    }
  }, [cur.data]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function save() {
    setMsg(null);
    try {
      await send("PUT", `/courses/${courseId}/taxonomy`, { category_ids: selCats, tag_ids: selTags });
      setMsg({ ok: true, text: "Categories and tags saved." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }
  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    try {
      const t = await send<Item>("POST", "/tags", { name: newTag });
      setNewTag("");
      setSelTags((s) => [...new Set([...s, t.id])]);
      tags.reload();
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    }
  }

  return (
    <Card title="Categories & tags" description="Help learners find your course in the catalog.">
      <h3 className="mb-2 text-sm font-medium text-slate-800">Categories</h3>
      <div className="flex flex-wrap gap-2">
        {cats.data?.map((c) => <Chip key={c.id} on={selCats.includes(c.id)} onClick={() => toggle(selCats, setSelCats, c.id)}>{c.name}</Chip>)}
        {cats.data?.length === 0 && <span className="text-sm text-slate-500">No categories yet. An admin creates them.</span>}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-medium text-slate-800">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.data?.map((t) => <Chip key={t.id} on={selTags.includes(t.id)} onClick={() => toggle(selTags, setSelTags, t.id)}>#{t.name}</Chip>)}
      </div>
      <form className="mt-3 flex max-w-sm gap-2" onSubmit={addTag}>
        <input className={input} placeholder="Add a new tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} required />
        <button className={button("secondary")}><Plus className="size-4" /> Add</button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button className={btn} onClick={save}><Save className="size-4" /> Save</button>
        <Flash msg={msg} />
      </div>
    </Card>
  );
}
