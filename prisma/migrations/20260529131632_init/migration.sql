-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InviteType" AS ENUM ('MEMBER', 'FRANCHISE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('ISSUE', 'IDEA');

-- CreateEnum
CREATE TYPE "TaskScope" AS ENUM ('ORG', 'GLOBAL');

-- CreateEnum
CREATE TYPE "SectionScope" AS ENUM ('ORG', 'GLOBAL');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('MANAGE_MEMBERS', 'MANAGE_ROLES', 'MANAGE_TIMETABLE', 'MANAGE_TASKS', 'MANAGE_SETTINGS', 'VIEW_TIMETABLE');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "ListDisplayType" AS ENUM ('TABLE', 'GRID', 'CHECKLIST', 'GALLERY');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "address" TEXT,
    "operatingDays" TEXT[],
    "openTimeMin" INTEGER,
    "closeTimeMin" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT NOT NULL,
    "botName" TEXT,
    "workingDays" TEXT[],
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "isDeletable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRole" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "minPeople" INTEGER NOT NULL DEFAULT 1,
    "maxPeople" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "preferredStartTimeMin" INTEGER,
    "minWaitDays" INTEGER,
    "maxWaitDays" INTEGER,
    "imageUrl" TEXT,
    "scope" "TaskScope" NOT NULL DEFAULT 'ORG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEligibility" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "TaskEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "taskColor" TEXT,
    "taskDescription" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTimeMin" INTEGER NOT NULL,
    "endTimeMin" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntryAssignee" (
    "id" TEXT NOT NULL,
    "timetableEntryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableEntryAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "viewType" "ViewType" NOT NULL DEFAULT 'WEEKLY',
    "startDay" TEXT NOT NULL DEFAULT 'mon',
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,
    "dayIndex" INTEGER NOT NULL,
    "startTimeMin" INTEGER NOT NULL,
    "endTimeMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTemplateEntryAssignee" (
    "id" TEXT NOT NULL,
    "templateEntryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableTemplateEntryAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "membershipOrgId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "shiftStartMin" INTEGER,
    "shiftEndMin" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterDayConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "recommendedSize" INTEGER NOT NULL DEFAULT 1,
    "openTimeMin" INTEGER,
    "closeTimeMin" INTEGER,

    CONSTRAINT "RosterDayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleWeeks" INTEGER NOT NULL DEFAULT 1,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "membershipOrgId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL DEFAULT 0,
    "dayIndex" INTEGER NOT NULL,
    "shiftStartMin" INTEGER,
    "shiftEndMin" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "usedByOrgId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "invitedById" TEXT,
    "recipientId" TEXT NOT NULL,
    "type" "InviteType" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "orgName" TEXT NOT NULL,
    "inviterName" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "imgUrl" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionRate" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "fromItemId" TEXT NOT NULL,
    "toItemId" TEXT NOT NULL,
    "fromQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "toQty" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "ConversionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "pinnedOutput" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConversionTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "type" "FeedbackType" NOT NULL,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskInheritance" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "inheritedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskInheritance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSectionLayout" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" "SectionScope" NOT NULL DEFAULT 'ORG',
    "position" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSectionLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorImage" TEXT,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCommentVote" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCommentVote_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "ToolItemList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgId" TEXT NOT NULL,
    "displayType" "ListDisplayType" NOT NULL DEFAULT 'GRID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolItemList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItemGridConfig" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "gridCols" INTEGER NOT NULL DEFAULT 4,
    "gridRows" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "ToolItemGridConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItemListEntry" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ToolItemListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolItemChecklistEntry" (
    "id" TEXT NOT NULL,
    "listEntryId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolItemChecklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_id_orgId_key" ON "Membership"("id", "orgId");

-- CreateIndex
CREATE INDEX "Role_orgId_idx" ON "Role"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_orgId_key_key" ON "Role"("orgId", "key");

-- CreateIndex
CREATE INDEX "Permission_roleId_idx" ON "Permission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_roleId_key" ON "Permission"("action", "roleId");

-- CreateIndex
CREATE INDEX "MemberRole_membershipId_idx" ON "MemberRole"("membershipId");

-- CreateIndex
CREATE INDEX "MemberRole_roleId_idx" ON "MemberRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRole_membershipId_roleId_key" ON "MemberRole"("membershipId", "roleId");

-- CreateIndex
CREATE INDEX "Task_orgId_idx" ON "Task"("orgId");

-- CreateIndex
CREATE INDEX "Task_scope_orgId_idx" ON "Task"("scope", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_orgId_name_key" ON "Task"("orgId", "name");

-- CreateIndex
CREATE INDEX "TaskEligibility_taskId_idx" ON "TaskEligibility"("taskId");

-- CreateIndex
CREATE INDEX "TaskEligibility_roleId_idx" ON "TaskEligibility"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEligibility_taskId_roleId_key" ON "TaskEligibility"("taskId", "roleId");

-- CreateIndex
CREATE INDEX "Tag_orgId_idx" ON "Tag"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_orgId_name_key" ON "Tag"("orgId", "name");

-- CreateIndex
CREATE INDEX "TaskTag_tagId_idx" ON "TaskTag"("tagId");

-- CreateIndex
CREATE INDEX "TimetableEntry_orgId_idx" ON "TimetableEntry"("orgId");

-- CreateIndex
CREATE INDEX "TimetableEntry_taskId_idx" ON "TimetableEntry"("taskId");

-- CreateIndex
CREATE INDEX "TimetableEntry_orgId_date_idx" ON "TimetableEntry"("orgId", "date");

-- CreateIndex
CREATE INDEX "TimetableEntryAssignee_membershipId_idx" ON "TimetableEntryAssignee"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntryAssignee_timetableEntryId_membershipId_key" ON "TimetableEntryAssignee"("timetableEntryId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSettings_orgId_key" ON "TimetableSettings"("orgId");

-- CreateIndex
CREATE INDEX "TimetableTemplate_orgId_idx" ON "TimetableTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTemplate_name_orgId_key" ON "TimetableTemplate"("name", "orgId");

-- CreateIndex
CREATE INDEX "TimetableTemplateEntryAssignee_membershipId_idx" ON "TimetableTemplateEntryAssignee"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTemplateEntryAssignee_templateEntryId_membershipId_key" ON "TimetableTemplateEntryAssignee"("templateEntryId", "membershipId");

-- CreateIndex
CREATE INDEX "RosterEntry_orgId_weekStart_idx" ON "RosterEntry"("orgId", "weekStart");

-- CreateIndex
CREATE INDEX "RosterEntry_membershipId_idx" ON "RosterEntry"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_orgId_membershipId_weekStart_dayIndex_key" ON "RosterEntry"("orgId", "membershipId", "weekStart", "dayIndex");

-- CreateIndex
CREATE INDEX "RosterDayConfig_orgId_idx" ON "RosterDayConfig"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterDayConfig_orgId_dayIndex_key" ON "RosterDayConfig"("orgId", "dayIndex");

-- CreateIndex
CREATE INDEX "RosterTemplate_orgId_idx" ON "RosterTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterTemplate_orgId_name_key" ON "RosterTemplate"("orgId", "name");

-- CreateIndex
CREATE INDEX "RosterTemplateEntry_templateId_idx" ON "RosterTemplateEntry"("templateId");

-- CreateIndex
CREATE INDEX "RosterTemplateEntry_membershipId_idx" ON "RosterTemplateEntry"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterTemplateEntry_templateId_membershipId_weekIndex_dayIn_key" ON "RosterTemplateEntry"("templateId", "membershipId", "weekIndex", "dayIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseToken_token_key" ON "FranchiseToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseToken_usedByOrgId_key" ON "FranchiseToken"("usedByOrgId");

-- CreateIndex
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");

-- CreateIndex
CREATE INDEX "Invite_recipientId_idx" ON "Invite"("recipientId");

-- CreateIndex
CREATE INDEX "Invite_invitedById_idx" ON "Invite"("invitedById");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_targetType_targetId_idx" ON "AuditLog"("orgId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_actorId_idx" ON "AuditLog"("orgId", "actorId");

-- CreateIndex
CREATE INDEX "ToolItem_orgId_idx" ON "ToolItem"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItem_orgId_name_key" ON "ToolItem"("orgId", "name");

-- CreateIndex
CREATE INDEX "ConversionSet_orgId_idx" ON "ConversionSet"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionSet_orgId_name_key" ON "ConversionSet"("orgId", "name");

-- CreateIndex
CREATE INDEX "ConversionRate_setId_idx" ON "ConversionRate"("setId");

-- CreateIndex
CREATE INDEX "ConversionRate_fromItemId_idx" ON "ConversionRate"("fromItemId");

-- CreateIndex
CREATE INDEX "ConversionRate_toItemId_idx" ON "ConversionRate"("toItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionRate_setId_fromItemId_toItemId_key" ON "ConversionRate"("setId", "fromItemId", "toItemId");

-- CreateIndex
CREATE INDEX "ConversionTemplate_setId_idx" ON "ConversionTemplate"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionTemplate_setId_name_key" ON "ConversionTemplate"("setId", "name");

-- CreateIndex
CREATE INDEX "ConversionTemplateEntry_templateId_idx" ON "ConversionTemplateEntry"("templateId");

-- CreateIndex
CREATE INDEX "ConversionTemplateEntry_itemId_idx" ON "ConversionTemplateEntry"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionTemplateEntry_templateId_itemId_key" ON "ConversionTemplateEntry"("templateId", "itemId");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_orgId_idx" ON "Feedback"("orgId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "TaskInheritance_taskId_idx" ON "TaskInheritance"("taskId");

-- CreateIndex
CREATE INDEX "TaskInheritance_orgId_idx" ON "TaskInheritance"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskInheritance_taskId_orgId_key" ON "TaskInheritance"("taskId", "orgId");

-- CreateIndex
CREATE INDEX "TaskSectionLayout_taskId_orgId_idx" ON "TaskSectionLayout"("taskId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSectionLayout_taskId_orgId_type_key" ON "TaskSectionLayout"("taskId", "orgId", "type");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_orgId_idx" ON "TaskComment"("taskId", "orgId");

-- CreateIndex
CREATE INDEX "TaskComment_parentId_idx" ON "TaskComment"("parentId");

-- CreateIndex
CREATE INDEX "TaskComment_authorId_idx" ON "TaskComment"("authorId");

-- CreateIndex
CREATE INDEX "TaskCommentVote_userId_idx" ON "TaskCommentVote"("userId");

-- CreateIndex
CREATE INDEX "ToolItemList_orgId_idx" ON "ToolItemList"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItemList_orgId_name_key" ON "ToolItemList"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItemGridConfig_listId_key" ON "ToolItemGridConfig"("listId");

-- CreateIndex
CREATE INDEX "ToolItemListEntry_listId_idx" ON "ToolItemListEntry"("listId");

-- CreateIndex
CREATE INDEX "ToolItemListEntry_itemId_idx" ON "ToolItemListEntry"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ToolItemChecklistEntry_listEntryId_key" ON "ToolItemChecklistEntry"("listEntryId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEligibility" ADD CONSTRAINT "TaskEligibility_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEligibility" ADD CONSTRAINT "TaskEligibility_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntryAssignee" ADD CONSTRAINT "TimetableEntryAssignee_timetableEntryId_fkey" FOREIGN KEY ("timetableEntryId") REFERENCES "TimetableEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntryAssignee" ADD CONSTRAINT "TimetableEntryAssignee_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSettings" ADD CONSTRAINT "TimetableSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplate" ADD CONSTRAINT "TimetableTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntry" ADD CONSTRAINT "TimetableTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TimetableTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntry" ADD CONSTRAINT "TimetableTemplateEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntryAssignee" ADD CONSTRAINT "TimetableTemplateEntryAssignee_templateEntryId_fkey" FOREIGN KEY ("templateEntryId") REFERENCES "TimetableTemplateEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTemplateEntryAssignee" ADD CONSTRAINT "TimetableTemplateEntryAssignee_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_membershipId_membershipOrgId_fkey" FOREIGN KEY ("membershipId", "membershipOrgId") REFERENCES "Membership"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterDayConfig" ADD CONSTRAINT "RosterDayConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTemplate" ADD CONSTRAINT "RosterTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTemplateEntry" ADD CONSTRAINT "RosterTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RosterTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterTemplateEntry" ADD CONSTRAINT "RosterTemplateEntry_membershipId_membershipOrgId_fkey" FOREIGN KEY ("membershipId", "membershipOrgId") REFERENCES "Membership"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseToken" ADD CONSTRAINT "FranchiseToken_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItem" ADD CONSTRAINT "ToolItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionSet" ADD CONSTRAINT "ConversionSet_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRate" ADD CONSTRAINT "ConversionRate_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ConversionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRate" ADD CONSTRAINT "ConversionRate_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRate" ADD CONSTRAINT "ConversionRate_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplate" ADD CONSTRAINT "ConversionTemplate_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ConversionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplateEntry" ADD CONSTRAINT "ConversionTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConversionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionTemplateEntry" ADD CONSTRAINT "ConversionTemplateEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInheritance" ADD CONSTRAINT "TaskInheritance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInheritance" ADD CONSTRAINT "TaskInheritance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSectionLayout" ADD CONSTRAINT "TaskSectionLayout_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSectionLayout" ADD CONSTRAINT "TaskSectionLayout_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCommentVote" ADD CONSTRAINT "TaskCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCommentVote" ADD CONSTRAINT "TaskCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemList" ADD CONSTRAINT "ToolItemList_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemGridConfig" ADD CONSTRAINT "ToolItemGridConfig_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ToolItemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemListEntry" ADD CONSTRAINT "ToolItemListEntry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ToolItemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemListEntry" ADD CONSTRAINT "ToolItemListEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ToolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolItemChecklistEntry" ADD CONSTRAINT "ToolItemChecklistEntry_listEntryId_fkey" FOREIGN KEY ("listEntryId") REFERENCES "ToolItemListEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
