"use client";

/**
 * Shared panels for creating and editing tasks.
 *
 * Image upload, tags, and eligibility are shared between the create and edit
 * flows. Create mode keeps selections locally and submits them as hidden
 * inputs; edit mode persists changes immediately via server actions.
 */

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addEligibilityAction,
  removeEligibilityAction,
  addTagAction,
  removeTagAction,
  createAndAddTagAction,
  createTagOnlyAction,
} from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";
import { useImageUpload } from "@/hooks/use-image-upload";
import { saveTaskImagePath } from "@/app/actions/storage";
import { OrgImagePicker } from "@/components/ui/org-image-picker";
import { TaskToolList, type TaskToolSelection } from "@/components/ui/task-tools";

export type Role = { id: string; name: string; color: string | null };
export type Tag = { id: string; name: string; color: string };

export function ToolPanel({
  orgId,
  tools,
}: {
  orgId: string;
  tools: TaskToolSelection[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {tools.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">No tools linked yet.</p>
      ) : (
        <TaskToolList orgId={orgId} tools={tools} />
      )}
    </div>
  );
}

// ─── Image upload panel ───────────────────────────────────────────────────────

const TASK_CROP_CONFIG = { aspect: 1, outputWidth: 600, outputHeight: 600 };

export function ImageUploadPanel({
  orgId,
  taskId,
  initialSignedUrl,
  fullWidth = false,
  layout = "default",
  fallbackColor,
  fallbackInitial,
}: {
  orgId: string;
  taskId: string;
  initialSignedUrl: string | null;
  fullWidth?: boolean;
  layout?: "default" | "detail" | "sidebar";
  fallbackColor?: string;
  fallbackInitial?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialSignedUrl);
  const { remove, isPending } = useImageUpload(orgId, taskId);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleRemove = () => {
    remove(() => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      toast.success("Image removed.");
    });
  };

  async function handleSelect(storagePath: string, signedUrl: string) {
    const result = await saveTaskImagePath(orgId, taskId, storagePath);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(signedUrl);
    toast.success("Image saved.");
  }

  if (layout === "sidebar") {
    return (
      <div className="flex flex-col gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Task photo"
            className="rounded-md aspect-square w-full object-cover"
          />
        ) : fallbackColor && fallbackInitial ? (
          <div
            className="rounded-md aspect-square w-full flex items-center justify-center text-4xl font-bold select-none"
            style={{
              backgroundColor: fallbackColor + "20",
              color: fallbackColor,
            }}
          >
            {fallbackInitial.toUpperCase()}
          </div>
        ) : (
          <div className="rounded-md aspect-square w-full bg-muted" />
        )}

        {previewUrl ? (
          <div className="flex flex-wrap gap-2">
            <OrgImagePicker
              orgId={orgId}
              config={TASK_CROP_CONFIG}
              disabled={isPending}
              onSelect={handleSelect}
              trigger={
                <Button type="button" variant="outline" size="sm" disabled={isPending}>
                  Replace
                </Button>
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={isPending}
            >
              Remove
            </Button>
          </div>
        ) : (
          <OrgImagePicker
            orgId={orgId}
            config={TASK_CROP_CONFIG}
            disabled={isPending}
            onSelect={handleSelect}
            trigger={
              <Button type="button" variant="outline" size="sm" className="w-fit" disabled={isPending}>
                Upload photo
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (layout === "detail") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
        <div>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Task photo"
              className="rounded-md aspect-square w-full object-cover"
            />
          ) : fallbackColor && fallbackInitial ? (
            <div
              className="rounded-md aspect-square w-full flex items-center justify-center text-4xl font-bold select-none"
              style={{
                backgroundColor: fallbackColor + "20",
                color: fallbackColor,
              }}
            >
              {fallbackInitial.toUpperCase()}
            </div>
          ) : (
            <div className="rounded-md aspect-square w-full bg-muted" />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">Photo</span>
          {previewUrl ? (
            <div className="flex flex-wrap gap-2">
              <OrgImagePicker
                orgId={orgId}
                config={TASK_CROP_CONFIG}
                disabled={isPending}
                onSelect={handleSelect}
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={isPending}>
                    Replace
                  </Button>
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={isPending}
              >
                Remove
              </Button>
            </div>
          ) : (
            <>
              <OrgImagePicker
                orgId={orgId}
                config={TASK_CROP_CONFIG}
                disabled={isPending}
                onSelect={handleSelect}
                trigger={
                  <Button type="button" variant="outline" size="sm" className="w-fit" disabled={isPending}>
                    Upload photo
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Photo</span>

      {previewUrl ? (
        <div className={`relative w-full${fullWidth ? "" : " max-w-sm"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Task photo"
            className="w-full rounded-lg object-cover max-h-48"
          />
          <div className="mt-2 flex gap-2">
            <OrgImagePicker
              orgId={orgId}
              config={TASK_CROP_CONFIG}
              disabled={isPending}
              onSelect={handleSelect}
              trigger={
                <Button type="button" variant="outline" size="sm" disabled={isPending}>
                  Replace
                </Button>
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={isPending}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <OrgImagePicker
          orgId={orgId}
          config={TASK_CROP_CONFIG}
          disabled={isPending}
          onSelect={handleSelect}
          trigger={
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={isPending}>
              Upload photo
            </Button>
          }
        />
      )}
    </div>
  );
}

// ─── Tag panel ───────────────────────────────────────────────────────────────

export type TagPanelProps =
  | {
      mode: "create";
      orgId: string;
      allTags: Tag[];
      selectedTags: Tag[];
      onSelectedTagsChange: (tags: Tag[]) => void;
    }
  | {
      mode: "edit";
      orgId: string;
      taskId: string;
      allTags: Tag[];
      taskTags: Tag[];
    };

export function TagPanel(props: TagPanelProps) {
  const isEdit = props.mode === "edit";
  const [tags, setTags] = useState<Tag[]>(isEdit ? props.taskTags : []);
  const [knownTags, setKnownTags] = useState<Tag[]>(props.allTags);
  const [isPending, startTransition] = useTransition();
  const selectedTags = isEdit ? tags : props.selectedTags;

  const tagIds = new Set(selectedTags.map((t) => t.id));
  const availableItems = knownTags.filter((t) => !tagIds.has(t.id));

  const add = (item: ComboboxItem) => {
    const tag = knownTags.find((t) => t.id === item.id);
    if (!tag) return;
    if (isEdit) {
      startTransition(async () => {
        const res = await addTagAction(props.orgId, props.taskId, tag.id);
        if (res.ok) setTags((prev) => [...prev, tag]);
        else toast.error(res.error);
      });
    } else {
      props.onSelectedTagsChange([...selectedTags, tag]);
    }
  };

  const createNew = (name: string) => {
    if (isEdit) {
      startTransition(async () => {
        const res = await createAndAddTagAction(props.orgId, props.taskId, name);
        if (res.ok) {
          setKnownTags((prev) => [...prev, res.tag]);
          setTags((prev) => [...prev, res.tag]);
        } else toast.error(res.error);
      });
    } else {
      startTransition(async () => {
        const res = await createTagOnlyAction(props.orgId, name);
        if (res.ok) {
          setKnownTags((prev) => [...prev, res.tag]);
          props.onSelectedTagsChange([...selectedTags, res.tag]);
        } else toast.error(res.error);
      });
    }
  };

  const remove = (tagId: string) => {
    if (isEdit) {
      startTransition(async () => {
        const res = await removeTagAction(props.orgId, props.taskId, tagId);
        if (res.ok) setTags((prev) => prev.filter((t) => t.id !== tagId));
        else toast.error(res.error);
      });
    } else {
      props.onSelectedTagsChange(selectedTags.filter((t) => t.id !== tagId));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Tags</span>

      {!isEdit &&
        selectedTags.map((tag) => (
          <input key={tag.id} type="hidden" name="tagIds" value={tag.id} />
        ))}

      <SearchableCombobox
        items={availableItems}
        onSelect={add}
        onCreate={createNew}
        triggerLabel="Add tag"
        placeholder={isEdit ? "Search or create tags…" : "Search or create tags…"}
        emptyText="No tags found"
        disabled={isPending}
      />

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {tag.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                onClick={() => remove(tag.id)}
                disabled={isPending}
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared eligibility panel ─────────────────────────────────────────────────

export type EligibilityPanelProps =
  | {
      mode: "create";
      allRoles: Role[];
      selectedRoles: Role[];
      onSelectedRolesChange: (roles: Role[]) => void;
    }
  | {
      mode: "edit";
      orgId: string;
      taskId: string;
      allRoles: Role[];
      eligibleRoles: Role[];
    };

export function EligibilityPanel(props: EligibilityPanelProps) {
  const isEdit = props.mode === "edit";
  const [roles, setRoles] = useState<Role[]>(isEdit ? props.eligibleRoles : []);
  const [isPending, startTransition] = useTransition();
  const selectedRoles = isEdit ? roles : props.selectedRoles;

  const roleIds = new Set(selectedRoles.map((r) => r.id));
  const availableItems = props.allRoles.filter((r) => !roleIds.has(r.id));

  const add = (item: ComboboxItem) => {
    const role = props.allRoles.find((r) => r.id === item.id);
    if (!role) return;
    if (isEdit) {
      startTransition(async () => {
        const res = await addEligibilityAction(
          props.orgId,
          props.taskId,
          role.id,
        );
        if (res.ok) setRoles((prev) => [...prev, role]);
        else toast.error(res.error);
      });
    } else {
      props.onSelectedRolesChange([...selectedRoles, role]);
    }
  };

  const remove = (roleId: string) => {
    if (isEdit) {
      startTransition(async () => {
        const res = await removeEligibilityAction(
          props.orgId,
          props.taskId,
          roleId,
        );
        if (res.ok) setRoles((prev) => prev.filter((r) => r.id !== roleId));
        else toast.error(res.error);
      });
    } else {
      props.onSelectedRolesChange(selectedRoles.filter((r) => r.id !== roleId));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Eligible roles</span>

      {!isEdit &&
        selectedRoles.map((role) => (
          <input key={role.id} type="hidden" name="roleIds" value={role.id} />
        ))}

      <SearchableCombobox
        items={availableItems}
        onSelect={add}
        triggerLabel="Add role"
        placeholder="Search roles…"
        emptyText="No roles found"
        disabled={isPending}
      />

      {selectedRoles.length === 0 ? (
        <p className="text-xs text-muted-foreground">All roles eligible</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selectedRoles.map((role) => (
            <span
              key={role.id}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs"
            >
              {role.color && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: role.color }}
                />
              )}
              {role.name}
              <button
                type="button"
                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                onClick={() => remove(role.id)}
                disabled={isPending}
                aria-label={`Remove ${role.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
