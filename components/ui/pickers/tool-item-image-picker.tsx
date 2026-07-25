"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { OrgImagePicker } from "@/components/ui/pickers/org-image-picker";
import { saveToolItemImagePath } from "@/app/actions/storage";

const ITEM_CROP = { aspect: 1, outputWidth: 512, outputHeight: 512 };

type ToolItemImagePickerProps = {
  orgId: string;
  itemId: string;
  disabled?: boolean;
  onSelect: (storagePath: string, signedUrl: string) => void;
  trigger?: ReactNode;
};

export function ToolItemImagePicker({
  orgId,
  itemId,
  disabled,
  onSelect,
  trigger,
}: ToolItemImagePickerProps) {
  return (
    <OrgImagePicker
      orgId={orgId}
      config={ITEM_CROP}
      disabled={disabled}
      onSelect={async (storagePath, signedUrl) => {
        const saveResult = await saveToolItemImagePath(orgId, itemId, storagePath);
        if (!saveResult.ok) {
          toast.error(saveResult.error);
          return;
        }
        onSelect(storagePath, signedUrl);
      }}
      trigger={trigger}
    />
  );
}