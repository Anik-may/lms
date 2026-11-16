"use client";
import { useState } from "react";
import { Archive, FolderTree, Pencil, Plus } from "lucide-react";
import { Category, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { btn, button, Card, Field, Flash, input, Msg, PageHeader, State } from "@/components/ui";

export default function AdminCategories() {
  const cats = useApi<Category[]>("/categories");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function run(fn: () => Promise<unknown>, done: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: done });
      await cats.reload();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    }
  }

  return (
    <>
      <PageHeader title="Categories" description="How courses are grouped in the catalog. Teachers pick from this list." />
      <Flash msg={msg} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="All categories" description={cats.data ? `${cats.data.length} active` : undefined} flush>
          <State loading={cats.loading} error={cats.error} empty={cats.data?.length === 0} emptyIcon={FolderTree} emptyTitle="No categories yet" emptyText="Add the first one on the right.">
            <ul className="divide-y divide-slate-100">
              {cats.data?.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  {editing?.id === c.id ? (
                    <form
                      className="flex flex-1 flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() => send("PATCH", `/categories/${c.id}`, { name: editing.name.trim() }), "Category renamed.").then((ok) => ok && setEditing(null));
                      }}
                    >
                      <input className={`${input} flex-1`} autoFocus aria-label="Category name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      <button className={button("primary", "sm")}>Save</button>
                      <button type="button" className={button("secondary", "sm")} onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><FolderTree className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{c.name}</p>
                        <p className="truncate text-xs text-slate-500">{c.description || `/${c.slug}`}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className={button("plain", "sm")} onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil className="size-3.5" /> Rename</button>
                        <button
                          className={button("plain", "sm")}
                          onClick={() => window.confirm(`Archive “${c.name}”? It will disappear from the catalog.`) && run(() => send("DELETE", `/categories/${c.id}`), `Archived “${c.name}”.`)}
                        >
                          <Archive className="size-3.5" /> Archive
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </State>
        </Card>

        <Card title="Add a category">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => send("POST", "/categories", { name: name.trim(), description: description.trim() || null }), `Added “${name.trim()}”.`).then((ok) => {
                if (!ok) return;
                setName("");
                setDescription("");
              });
            }}
          >
            <Field label="Name">
              <input className={input} required placeholder="e.g. Data science" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description" hint="Optional.">
              <textarea className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <button className={`${btn} w-full`}><Plus className="size-4" /> Add category</button>
          </form>
        </Card>
      </div>
    </>
  );
}
