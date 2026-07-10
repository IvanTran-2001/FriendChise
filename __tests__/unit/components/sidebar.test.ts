import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import * as navigation from "next/navigation";

const mockOrgSettingsPermissions: {
  orgId: string | null;
  permissions: {
    canManageOrgSettings: boolean;
    canManageRoles: boolean;
    canManageSettings: boolean;
  } | null;
} = {
  orgId: null,
  permissions: null,
};

// Define a mutable reference for useState mock implementation
let mockUseStateImpl: any = null;

// Mock react BEFORE importing the sidebar component so it uses the mocked hooks
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: (init: any) => {
      if (mockUseStateImpl) {
        return mockUseStateImpl(init);
      }
      return original.useState(init);
    },
    useContext: (_ctx: any) => {
      // Mock MobileSidebarCtx (or any other context) to return standard defaults
      return { open: false, setOpen: () => {} };
    },
    useEffect: () => {
      // Mock useEffect as a noop to avoid hook validation issues in node test env
    },
  };
});

import { AppSidebar } from "@/components/layout/sidebar";

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => React.createElement("a", props, children),
}));

vi.mock("@/components/layout/org-settings-permissions-context", () => ({
  useOrgSettingsPermissions: () => mockOrgSettingsPermissions,
}));

vi.mock("./logo", () => ({
  Logo: () => null,
}));

vi.mock("./sidebar-nav-item", () => {
  const SidebarNavItem = () => null;
  return { SidebarNavItem };
});

function findNavItems(element: any): any[] {
  if (!element) return [];
  if (element.props && typeof element.props.title === "string" && "url" in element.props) {
    return [element.props];
  }
  let items: any[] = [];
  if (element.props && element.props.children) {
    const children = React.Children.toArray(element.props.children);
    for (const child of children) {
      items = items.concat(findNavItems(child));
    }
  }
  return items;
}

describe("AppSidebar - Settings Filtering", () => {
  const mockUseParams = vi.mocked(navigation.useParams);
  const mockUsePathname = vi.mocked(navigation.usePathname);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStateImpl = null;
    mockOrgSettingsPermissions.orgId = null;
    mockOrgSettingsPermissions.permissions = null;
  });

  it("renders no settings items when permissions are loading (null)", () => {
    mockUseParams.mockReturnValue({ orgId: "org-1" });
    mockUsePathname.mockReturnValue("/orgs/org-1/settings/organization");
    mockOrgSettingsPermissions.orgId = "org-1";

    let stateIndex = 0;
    const mockStates = [
      // Call 1: parentOwnerStatus state
      [{ orgId: "org-1", isParentOwner: false, parentOrgId: null }, vi.fn()],
    ];

    mockUseStateImpl = () => {
      const pair = mockStates[stateIndex];
      stateIndex++;
      return pair;
    };

    const element = AppSidebar();
    const renderedItems = findNavItems(element);

    // No settings items should be rendered
    expect(renderedItems).toHaveLength(0);
  });

  it("renders only authorized settings items for a limited user", () => {
    mockUseParams.mockReturnValue({ orgId: "org-1" });
    mockUsePathname.mockReturnValue("/orgs/org-1/settings/organization");
    mockOrgSettingsPermissions.orgId = "org-1";
    mockOrgSettingsPermissions.permissions = {
      canManageOrgSettings: false,
      canManageRoles: true,
      canManageSettings: false,
    };

    let stateIndex = 0;
    const mockStates = [
      // Call 1: parentOwnerStatus state
      [{ orgId: "org-1", isParentOwner: false, parentOrgId: null }, vi.fn()],
    ];

    mockUseStateImpl = () => {
      const pair = mockStates[stateIndex];
      stateIndex++;
      return pair;
    };

    const element = AppSidebar();
    const renderedItems = findNavItems(element);

    // Only 'Roles' and 'User' should be rendered.
    // 'Org', 'Tags', 'Timetable', 'Notification' are filtered out.
    expect(renderedItems.map((item) => item.title)).toEqual(["Roles", "User"]);
  });

  it("renders all settings items for an owner user", () => {
    mockUseParams.mockReturnValue({ orgId: "org-1" });
    mockUsePathname.mockReturnValue("/orgs/org-1/settings/organization");
    mockOrgSettingsPermissions.orgId = "org-1";
    mockOrgSettingsPermissions.permissions = {
      canManageOrgSettings: true,
      canManageRoles: true,
      canManageSettings: true,
    };

    let stateIndex = 0;
    const mockStates = [
      // Call 1: parentOwnerStatus state
      [{ orgId: "org-1", isParentOwner: true, parentOrgId: null }, vi.fn()],
    ];

    mockUseStateImpl = () => {
      const pair = mockStates[stateIndex];
      stateIndex++;
      return pair;
    };

    const element = AppSidebar();
    const renderedItems = findNavItems(element);

    // All settings items should be rendered
    expect(renderedItems.map((item) => item.title)).toEqual([
      "Org",
      "Roles",
      "Tags",
      "User",
      "Timetable",
      "Notification",
    ]);
  });
});
