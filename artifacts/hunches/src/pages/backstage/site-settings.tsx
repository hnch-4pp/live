import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { apiUrl } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Loader2, ShieldOff, ShieldCheck, Bold, Italic, Underline, List, ListOrdered, Undo, Redo } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapUnderline from "@tiptap/extension-underline";

interface SiteSettings {
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
}

function adminFetch(path: string, options?: RequestInit) {
  return fetch(apiUrl(`/api${path}`), {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Admin-Request": "1", ...(options?.headers ?? {}) },
  });
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-violet-100 text-violet-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminSiteSettings() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<SiteSettings>({
    queryKey: ["admin", "site-settings"],
    queryFn: () => adminFetch("/admin/site-settings").then((r) => r.json()),
  });

  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, TiptapUnderline],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-[160px] px-4 py-3 text-sm text-gray-800 focus:outline-none prose prose-sm max-w-none",
      },
    },
  });

  // Populate editor once data arrives (editor initialises before the fetch completes)
  useEffect(() => {
    if (editor && data?.maintenanceMessage && editor.isEmpty) {
      editor.commands.setContent(data.maintenanceMessage);
    }
  }, [editor, data?.maintenanceMessage]);

  const effectiveEnabled = maintenanceEnabled !== null ? maintenanceEnabled : (data?.maintenanceEnabled ?? false);

  const mutation = useMutation({
    mutationFn: (settings: SiteSettings) =>
      adminFetch("/admin/site-settings", { method: "PUT", body: JSON.stringify(settings) }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-status"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = useCallback(() => {
    mutation.mutate({
      maintenanceEnabled: effectiveEnabled,
      maintenanceMessage: editor?.getHTML() ?? data?.maintenanceMessage ?? "",
    });
  }, [mutation, effectiveEnabled, editor, data]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Acceso al sitio</h1>
          <p className="text-sm text-gray-500 mt-1">
            Controla si los visitantes pueden acceder a la plataforma o ven un aviso de mantenimiento.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {/* Toggle */}
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {effectiveEnabled ? (
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <ShieldOff className="w-5 h-5 text-red-500" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
              )}
              <div>
                <Label className="text-sm font-semibold text-gray-900 cursor-pointer">
                  {effectiveEnabled ? "Sitio bloqueado" : "Sitio abierto"}
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {effectiveEnabled
                    ? "Los visitantes ven el aviso de mantenimiento en lugar del sitio."
                    : "Los visitantes acceden normalmente a la plataforma."}
                </p>
              </div>
            </div>
            <Switch
              checked={effectiveEnabled}
              onCheckedChange={setMaintenanceEnabled}
            />
          </div>

          {/* Message editor */}
          <div className="px-6 py-5">
            <Label className="text-sm font-semibold text-gray-900 mb-3 block">
              Mensaje para visitantes
            </Label>
            <p className="text-xs text-gray-500 mb-3">
              Este mensaje se muestra cuando el sitio esta bloqueado. Puedes usar formato de texto.
            </p>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  active={editor?.isActive("bold")}
                  title="Negrita"
                >
                  <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  active={editor?.isActive("italic")}
                  title="Cursiva"
                >
                  <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  active={editor?.isActive("underline")}
                  title="Subrayado"
                >
                  <Underline className="w-4 h-4" />
                </ToolbarButton>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  active={editor?.isActive("bulletList")}
                  title="Lista"
                >
                  <List className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  active={editor?.isActive("orderedList")}
                  title="Lista numerada"
                >
                  <ListOrdered className="w-4 h-4" />
                </ToolbarButton>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().undo().run()}
                  title="Deshacer"
                >
                  <Undo className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().redo().run()}
                  title="Rehacer"
                >
                  <Redo className="w-4 h-4" />
                </ToolbarButton>
              </div>

              {/* Editor */}
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
            ) : saved ? (
              <><Save className="w-4 h-4 mr-2" />Guardado</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Guardar cambios</>
            )}
          </Button>
          {mutation.isError && (
            <p className="text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
          )}
        </div>

        {/* Preview */}
        {effectiveEnabled && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vista previa del aviso</p>
            <div className="border border-dashed border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex justify-center mb-6">
                <img src="/hunch-logo.png" alt="Hunch" className="h-8 w-auto" />
              </div>
              <div
                className="prose prose-sm max-w-none text-center text-gray-700"
                dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? "" }}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
