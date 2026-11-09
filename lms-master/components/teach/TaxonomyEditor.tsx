"use client";
import { useEffect, useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, btn, input } from "./ui";

type Item = { id: string; name: string };

export default function TaxonomyEditor({ courseId }: { courseId: string }) {
  const cats = useApi<Item[]>("/categories");
  const tags = useApi<Item[]>("/tags");
  const cur = useApi<{ categories: Item[]; tags: Item[] }>(`/courses/${courseId}/taxonomy`);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [selTags, setSelTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (cur.data) {
      setSelCats(cur.data.categories.map((c) => c.id)); // eslint-disable-line react-hooks/set-state-in-effect
      setSelTags(cur.data.tags.map((t) => t.id));
    }
  }, [cur.data]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function save() {
    try {
      await send("PUT", `/courses/${courseId}/taxonomy`, { category_ids: selCats, tag_ids: selTags });
      setMsg("Saved");
    } catch (e) {
      setMsg((e as Error).message);
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
      setMsg((er as Error).message);
    }
  }
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-secondary bg-secondary text-white" : "border-gray-300"}`;

  return (
    <Card title="Categories & tags">
      <div className="mb-3 flex flex-wrap gap-2">
        {cats.data?.map((c) => <button key={c.id} className={chip(selCats.includes(c.id))} onClick={() => toggle(selCats, setSelCats, c.id)}>{c.name}</button>)}
        {cats.data?.length === 0 && <span className="text-sm text-gray-500">No categories yet (an admin creates them).</span>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {tags.data?.map((t) => <button key={t.id} className={chip(selTags.includes(t.id))} onClick={() => toggle(selTags, setSelTags, t.id)}>#{t.name}</button>)}
      </div>
      <form className="mb-3 flex gap-2" onSubmit={addTag}>
        <input className={`${input} max-w-xs`} placeholder="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} required />
        <button className="rounded-lg border px-3 py-1.5 text-sm">Add tag</button>
      </form>
      <button className={btn} onClick={save}>Save</button> <span className="ml-2 text-sm text-gray-600">{msg}</span>
    </Card>
  );
}
