---
title: Project Structure
description: hello
order: 18.5
---
```text
app/
  (app)/                  # Authenticated app shell (navbar + sidebar layout)
    page.tsx              # Home / landing page
    layout.tsx            # Shared layout: SidebarProvider, NavBar, ActionSidebarSlot
    orgs/
      (organizations)/    # Route group: org-management pages (shared OrgManagementNav sidebar)
        layout.tsx        # Registers OrgManagementNav as page sidebar for all child routes
        page.tsx          # /orgs — organizations list (stub)
        new/              # Create org page
        join/             # Join as franchisee via one-time token
        invite/           # Invitations list (stub)
        _components/
          org-management-nav.tsx  # Page sidebar nav (Create, Join, Invite, List)
      [orgId]/
        page.tsx          # Org overview — stat cards, today's schedule, org header
        loading.tsx       # Overview page skeleton
        tools/            # Tools hub — sidebar with search + tool nav list
          page.tsx        # Server page; registers ToolsSidebarContent as page sidebar
          tools-client.tsx
          _components/
            tools-sidebar-content.tsx  # Nav links: Item List · Conversion · Roster + search
          item-list/      # Item List tool — catalogue lists for stations/jobs
            page.tsx      # Hub page: lists all ToolItemLists for the org; registers ItemListSidebarShell
            loading.tsx   # Hub loading skeleton
            layout.tsx    # Registers ItemListSidebarShell for all item-list routes
            _components/
              item-list-sidebar-shell.tsx  # Persistent sidebar shell (panel title + Back link)
              item-list-sidebar-content.tsx # Title row + Back link
              item-list-client.tsx          # Hub client: grid of item tiles with image + name
              item-detail-panel.tsx         # ActionSidebar panel: view/edit a ToolItem (name, unit, image)
            lists/        # List-of-lists index
              page.tsx    # Server page: fetches ToolItemLists; registers ItemListsSidebarContent
              loading.tsx # Lists index loading skeleton (toolbar + row placeholders)
              _components/
                item-lists-sidebar-content.tsx  # Sidebar: view toggle (list/card) + Create List
                item-lists-client.tsx           # Client: search, list/card views; inline edit, duplicate, delete via ⋯ dropdown
            [listId]/     # Individual list detail
              page.tsx    # Server page: resolves active ConversionSet from ?set= param (or cookie fallback); fetches entries + rates; renders ListDetailClient
              loading.tsx # List detail loading skeleton (sidebar + 4×4 grid placeholders)
              _components/
                list-detail-client.tsx        # Top-level detail client: toolbar, grid/checklist view switch
                list-detail-sidebar-content.tsx # Sidebar: view toggle, Add Item, grid-size controls, Apply Rates set picker (persisted via cookie `item-list-rates-prefs-{orgId}`)
                list-grid-view.tsx            # Grid view: item cells with image, name, amount, and live conversion rates
                list-checklist-view.tsx       # Checklist view: toggleable item rows
                add-item-to-list-panel.tsx    # ActionSidebar panel: search org items and add to list
                item-detail-panel.tsx         # ActionSidebar panel: edit entry amount
                item-rates-panel.tsx          # ActionSidebar panel: show all rates for a cell's item
          conversion/     # Conversion calculator tool
            page.tsx      # Server page: fetches all ConversionSets; registers ConversionSidebarContent
            conversion-client.tsx
            _components/
              conversion-sidebar-content.tsx  # Title + Back link + "Add Set" action button
              add-set-form.tsx                # Create / list ConversionSets
              edit-set-form.tsx               # Rename a ConversionSet
            [setId]/       # Set detail — calculator view
              page.tsx     # Server page: resolves active template from ?template= param; fetches entries; renders SetDetailClient with key={activeTemplateId}
              set-detail-client.tsx  # Calculator — two-column From/To grid; template dropdown in toolbar; DB-backed state via ConversionTemplateEntry
              _components/
                set-sidebar-content.tsx   # Sidebar: Items · Rates · Templates action buttons
                add-item-form.tsx         # Create ToolItem (org-scoped, shared across sets)
                add-rate-form.tsx         # Create/delete ConversionRate; unit abbreviation helper (≤4 chars kept, longer → first+last letter)
                add-template-form.tsx     # Create/delete/switch ConversionTemplate; URL-driven active state via ?template=<id>
          roster/         # Roster tool — weekly shift grid + templates
            page.tsx      # Server page; fetches week range, members, day configs; registers RosterSidebarContent
            _components/
              roster-sidebar-content.tsx  # Title row + Back + Templates link + Edit Day Config action
              roster-board-constants.ts   # Grid dimension constants (cell width, day labels) shared by board and template board
              roster-board.tsx            # Scrollable 7-row × N-week grid; each cell opens EditCellDialog
              roster-client.tsx           # Week navigation state + board rendering
              roster-page-client.tsx      # Combines RosterClient with sticky toolbar (week range label)
              edit-cell-dialog.tsx        # Dialog: assign members + shift start/end for one (week, day) cell
              edit-day-config-dialog.tsx  # Dialog: set recommendedSize + open/close times for a day column
              apply-template-panel.tsx    # ActionSidebar panel: pick template, start date, repeat count, force checkbox
            _utils/
              time-utils.ts              # Shared: formatMinutes, timeToMinutes, hoursWorked
            templates/
              page.tsx                   # Server page; lists all roster templates; registers RosterTemplatesSidebarContent
              _components/
                roster-templates-client.tsx         # Template list (card view); Create/Rename/Delete actions
                roster-templates-sidebar-content.tsx # Sidebar: Back link + Create Template action
              [templateId]/
                page.tsx                 # Server page; fetches template + entries + members
                _components/
                  roster-template-editor-client.tsx  # Cycle stepper (+ / − weeks), column-paged board; ResizeObserver for visible column count
                  roster-template-board.tsx          # Template grid: weekIndex columns × 7 day rows; each cell opens EditTemplateCellPanel in ActionSidebar
                  edit-template-cell-panel.tsx       # ActionSidebar panel: assign members + shift times for one (weekIndex, day) cell
        franchisee/       # Franchise management (parent org owners only)
        memberships/      # Members list, role filter, list/card toggle, invite/add actions
          layout.tsx            # Registers MembersSidebarShell for all memberships routes
          [memberId]/     # Member detail view (view-only, roles, working days, status)
            page.tsx
            edit/         # Edit member form (working days, roles)
            _components/
              member-toolbar-actions.tsx  # Restrict/Unrestrict + Delete confirm dialogs
          _components/
            members-sidebar-shell.tsx   # Persistent sidebar shell (panel title + List nav tab + sub-content slot)
            members-sidebar-content.tsx # Filters (role dropdown, list/card toggle) + MembersActions
            members-actions.tsx         # Invite Member + Add Bot buttons; ActionSidebar on desktop, Dialog on mobile
            invite-member-panel.tsx     # InviteMemberPanel (ActionSidebar form) + InviteMemberDialog (mobile popup)
            add-bot-panel.tsx           # AddBotPanel (ActionSidebar form) + AddBotDialog (mobile popup)
            members-view.tsx            # Client component: toolbar (search only), list/card views
            member-form.tsx             # Shared create/edit form (email, working days, RolePicker)
            role-picker.tsx             # Searchable role input — selecting auto-adds, no + button
        tasks/            # Task definition list + create form
          layout.tsx            # Registers TasksSidebarShell for all tasks routes
          [taskId]/       # Task detail view (links from timetable)
            edit/         # Edit task form (includes color picker)
            comments/     # Task comment section
              index.tsx             # Async server component — gates access, fetches comments, passes to client
              comment-section.tsx   # Client shell — owns reply/edit open state, calls router.refresh() after mutations
              comment-item.tsx      # One comment row — votes (optimistic), pin, edit, delete, reply
              comment-input.tsx     # Controlled textarea for posting/replying
              types.ts              # CommentFE type (ISO string dates, aggregated votes)
          task-form.tsx   # Shared create/edit form — title, color picker, image upload (crop dialog), eligibility
          _components/
            tasks-config.ts             # Shared sort constants (SortOption, SORT_OPTIONS) — plain module, no "use client"
            tasks-sidebar-shell.tsx     # Persistent sidebar shell (panel title + List nav tab + sub-content slot)
            tasks-sidebar-content.tsx   # Filters (sort dropdown, role filter, view toggle) + Create Task action
            task-table.tsx              # Client component: toolbar (search only), list/card views
        timetable/        # Weekly timetable, template selector, template editor
          layout.tsx            # Registers TimetableSidebarShell for all timetable routes
          page.tsx              # Server page: fetches week entries, permissions, roles
          _components/          # Page-specific components (sidebar, actions, filters)
            timetable-sidebar-shell.tsx   # Persistent sidebar shell with Schedule/Templates tabs
            timetable-sidebar-content.tsx # Filters + action buttons for the schedule page
            timetable-actions.tsx         # Apply Template + Add Task buttons (ActionSidebar on desktop, fallback on mobile)
            add-task-panel.tsx            # Two-mode panel: searchable/draggable task list → schedule form
            apply-template-dialog.tsx     # Form for applying a template to a date range
            role-filter-button.tsx        # Role filter dropdown (URL-state driven)
            timetable-view-picker.tsx     # Calendar/Simple + Day/Week segmented controls
            timetable-pref-redirect.tsx   # Restores mode/span from localStorage on first load
          _shared/              # Shared grid primitives (used by timetable + template editor)
            time-grid.tsx       # Drag-and-drop time grid
            task-panel.tsx      # Sidebar panel listing draggable tasks (mobile sheet + template editor)
            grid-utils.ts       # Pure utilities: snap, layout, date helpers
            types.ts            # Shared TypeScript types
          timetable-client/     # CalendarView / SimpleView client components
          templates/            # Template list and editor sub-pages
        settings/
          page.tsx        # Redirects to /settings/organization
          organization/   # Org info, timezone, hours, transfer, delete
          roles/          # Role list (MANAGE_ROLES)
            _components/
              role-form.tsx               # Shared create/edit form (name, color, permissions, task eligibility picker)
              roles-sidebar-content.tsx   # Page sidebar: "+ Create Role" button → opens RoleForm in ActionSidebar
            page.tsx                      # Registers RolesSidebarContent as page sidebar; table rendered by RolesClient
            roles-client.tsx              # Table of roles; row ··· menu Edit → ActionSidebar, Delete → AlertDialog
          tags/           # Tag list (MANAGE_TASKS)
            _components/
              tag-form.tsx                # Shared create/edit form (name, color)
              tags-sidebar-content.tsx    # Page sidebar: "+ Create Tag" button → opens TagForm in ActionSidebar
            page.tsx                      # Registers TagsSidebarContent as page sidebar; table rendered by TagsClient
            tags-client.tsx               # Table of tags; row ··· menu Edit → ActionSidebar, Delete → AlertDialog
          timetable/      # Timetable display settings (stub)
          notification/   # Notification preferences (stub)
  (auth)/
    signin/               # Google OAuth sign-in page; renders DevUserPicker in development
      dev-sign-in-action.ts  # Server action for dev credentials sign-in
      dev-user-picker.tsx    # Client component: searchable list of seeded test accounts
  actions/                # Server Actions (web UI mutations)
    orgs.ts
    memberships.ts
    tasks.ts              # createTaskAction, updateTaskAction — both require color hex
    templates.ts
    timetable-entries.ts
    franchisee.ts
    roles.ts
    tags.ts               # Tag CRUD mutations (createTag, updateTag, deleteTag) — all require MANAGE_TASKS
    roster.ts             # Roster entry and day-config mutations (requires MANAGE_MEMBERS)
    feedback.ts           # submitFeedbackAction — creates a Feedback row + optional screenshot upload
    tools.ts              # Conversion + Item List tool mutations — all require MANAGE_TASKS
                          #   Conversion: createConversionSetAction, deleteConversionSetAction, renameConversionSetAction, createToolItemAction…
                          #   Item List: createToolItemListAction, updateToolItemListAction, deleteToolItemListAction, duplicateToolItemListAction,
                          #              addToolItemListEntryAction, moveToolItemListEntryAction, removeToolItemListEntryAction,
                          #              updateToolItemListEntryAmountAction, toggleChecklistEntryAction, updateToolItemGridConfigAction
    storage.ts            # Image upload actions for task images (private) and org logos (public)
    task-comments.ts      # addCommentAction, editCommentAction, deleteCommentAction, voteCommentAction, pinCommentAction
  api/                    # REST API route handlers (session-authenticated)
    auth/[...nextauth]/
    orgs/
      route.ts
      [orgId]/
        is-parent-owner/
        memberships/
        tasks/
        task-instances/
          [taskInstanceId]/
            route.ts
            assignees/
            status/

components/
  layout/
    navbar.tsx                  # Top bar — h-12 server component; fetches org logos + notification counts server-side
    navbar-context-actions.tsx  # Route-aware action buttons
    sidebar.tsx                 # Global app sidebar: desktop hover-expand (w-12→w-52), mobile overlay
    sidebar-nav-item.tsx        # Shared nav link — variant="app" (icon-well) or variant="page" (inline)
    mobile-sidebar-context.tsx  # Boolean context for mobile sidebar overlay open/close state
    page-sidebar-context.tsx    # Slot-based page sidebar: RegisterPageSidebar + PageSidebarSlot + RegisterPageSidebarSubContent sub-content slot
    action-sidebar-context.tsx  # Transient action panel (ActionSidebarSlot) beside page sidebar; open/close via hook
    org-switcher.tsx            # Org selector dropdown — shows logo image when available, falls back to colored letter badge
    toolbar.tsx                 # h-12 sticky sub-header; cancels main padding with negative margins; left-pads when sidebar collapsed; uses useLayoutEffect to avoid height flash on load; children are optional (renders as empty bar)
    actions/
      tasks-actions.tsx
      members-actions.tsx
  ui/                           # shadcn/ui + Radix UI primitives
                                # image-crop-dialog.tsx — reusable pan/zoom crop dialog (react-easy-crop)
                                #   exports ImageCropConfig + ImageCropDialog
                                #   used by task-form.tsx (1:1 600×600) and settings-client.tsx (1:1 512×512)

lib/
  prisma.ts
  rbac.ts               # ROLE_KEYS constants (OWNER, DEFAULT_MEMBER)
  utils.ts
  supabase-storage.ts   # Server-only Supabase Storage REST helpers (no SDK)
                        #   Private bucket (task images): createSignedUploadUrl, createSignedReadUrl, deleteStorageFile
                        #   Public bucket (org logos):    createSignedUploadUrlPublic, getPublicUrl, deletePublicFile
  authz/
    _shared.ts
    api.ts
    page.ts
    action.ts
    index.ts
  services/
    types.ts
    audit-log.ts        # logAudit() write helper (Zod-validated) + getAuditLogs() read helper
    orgs.ts             # updateOrgImage(orgId, imageUrl | null) — sets Organization.image
    memberships.ts      # updateMembership rejects any roleId whose key === "owner"
    tasks.ts            # createTask / updateTask both require and persist color
    timetable-entries.ts
    assignees.ts
    templates.ts
    roles.ts
    franchise.ts
    invites.ts
    bots.ts
    tags.ts             # Tag CRUD — createTag, updateTag, deleteTag
    task-sections.ts    # TaskSectionLayout reads and updates (per-org section config)
    feedback.ts         # submitFeedback — creates Feedback row, resolves storage path
    roster.ts           # RosterEntry + RosterDayConfig CRUD, template-apply helper
    tools.ts            # ConversionSet · ToolItem · ConversionRate · ConversionTemplate · ConversionTemplateEntry CRUD
                        # ToolItemList CRUD: getToolItemLists, getToolItemListDetail, createToolItemList, updateToolItemList, deleteToolItemList, duplicateToolItemList
                        # ToolItemListEntry CRUD: addToolItemListEntry, addToolItemListEntryAtPosition, moveToolItemListEntry, removeToolItemListEntry, updateToolItemListEntryAmount
                        # Grid config: updateToolItemGridConfig
                        # Checklist: toggleChecklistEntry (presence = checked)
    task-comments.ts    # getTaskComments, canUserCommentOnTask, createComment, editComment, softDeleteComment, voteOnComment, setPinComment
  validators/
    org.ts
    membership.ts
    task.ts             # createTaskSchema / updateTaskSchema require color: /^#[0-9a-fA-F]{6}$/
    task-instance.ts
    assignee.ts
    role.ts
    task-comment.ts     # addCommentSchema (content + optional parentId), editCommentSchema (content only)

prisma/
  schema.prisma         # Role.color String (non-nullable), Task.color String (non-nullable)
  seed.ts               # 8 users · 3 orgs · 4 roles each · 6 tasks each · 5 members each; calls seedConversionData for Walker's Doughnuts tool items, conversion sets, and item lists
  seeds/
    walkers-doughnuts.ts  # Standalone seed function for the Walker's Doughnuts org: 40+ ToolItems, 3 ConversionSets with rates + templates, and 3 ToolItemLists
```

