"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { getOrgSettingsPermissions } from "@/app/actions/orgs";

export type OrgSettingsPermissions = {
  canManageOrgSettings: boolean;
  canManageRoles: boolean;
  canManageSettings: boolean;
};

type OrgSettingsPermissionsCtxValue = {
  orgId: string | null;
  permissions: OrgSettingsPermissions | null;
};

const OrgSettingsPermissionsCtx = createContext<OrgSettingsPermissionsCtxValue>({
  orgId: null,
  permissions: null,
});

export function OrgSettingsPermissionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { orgId } = useParams<{ orgId?: string }>();
  const [state, setState] = useState<OrgSettingsPermissionsCtxValue>({
    orgId: null,
    permissions: null,
  });

  useEffect(() => {
    if (!orgId) return;

    let active = true;
    getOrgSettingsPermissions(orgId)
      .then((permissions) => {
        if (active) {
          setState({ orgId, permissions });
        }
      })
      .catch((err) => {
        console.error("Failed to load settings permissions:", err);
        if (active) {
          setState({ orgId, permissions: null });
        }
      });

    return () => {
      active = false;
    };
  }, [orgId]);

  const value = orgId && state.orgId === orgId ? state : { orgId: null, permissions: null };

  return (
    <OrgSettingsPermissionsCtx.Provider value={value}>
      {children}
    </OrgSettingsPermissionsCtx.Provider>
  );
}

export function useOrgSettingsPermissions() {
  return useContext(OrgSettingsPermissionsCtx);
}