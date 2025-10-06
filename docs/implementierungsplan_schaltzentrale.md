<implementation_plan>
    <objective>
        This document outlines the implementation of a seating plan management system based on the "Active Plan" model, designed to be fully compatible with an auto-save environment.
        The goal is to allow users to intuitively create, manage, and switch between multiple seating arrangements for any class. The core UX will be centered in the editor, not hidden in a settings menu.
    </objective>

    <execution_rules>
        <rule>Follow the implementation steps sequentially.</rule>
        <rule>For all design and styling, refer to the component analysis to ensure consistency.</rule>
        <rule>If minor ambiguities are found, make a reasonable assumption based on the project context and proceed.</rule>
    </execution_rules>

    <user_experience_workflow>
        <step name="Select Context">In the editor, the user selects a `Class` and a `Room`. The `Room` dropdown includes a `[Blank Canvas]` option for room-independent plans.</step>
        <step name="Initial Load">The system loads the `Default Plan` for the selected context. A new, central "Active Plan" dropdown appears in the editor header, showing "Default Plan" as active.</step>
        <step name="Live Editing">User modifies the seating arrangement. Changes are auto-saved to the currently active plan.</step>
        <step name="Create New Version">To create a new version, the user clicks the "Active Plan" dropdown, selects `+ Create New Plan...`, and gives it a name (e.g., "Project Week"). This new plan immediately becomes the active one.</step>
        <step name="Switching Plans">The user can switch between the "Default Plan" and any other created plans at any time using the "Active Plan" dropdown. The editor's content reloads, and auto-save targets the newly selected active plan.</step>
    </user_experience_workflow>

    <architecture_and_data_flow>
        <frontend>
            <primary_ui_location>The core feature is the new "Active Plan" dropdown menu located in the editor's header (`components/editor/EditorHeader.tsx`).</primary_ui_location>
            <state_management>The editor's state (`useEditorState.ts`) must manage the `activePlanId` and the list of available plans for the current context.</state_management>
        </frontend>
        <backend>
            <data_model>
                The `Plan` model in `prisma/schema.prisma` is central. It requires a mechanism to identify the single default plan for each `(Class, Room?)` context. A boolean flag `isDefault: Boolean` is recommended. A unique constraint should enforce that only one plan can be the default for a given context.
            </data_model>
            <interaction_method>All interactions will be handled via Next.js Server Actions in `server/actions/plans.ts`.</interaction_method>
        </backend>
    </architecture_and_data_flow>

    <step_by_step_implementation>
        <step number="1" title="Backend & Data Model">
            <details>
                Update `prisma/schema.prisma` with the `Plan` model, including `name: String`, `layout: Json`, `isDefault: Boolean`, and relations to `Profile`, `Class`, and `Room?`.
                Create or update the server actions in `server/actions/plans.ts`.
            </details>
            <actions_to_implement in_file="server/actions/plans.ts">
                <action>getOrCreateDefaultPlan(classId, roomId?): Fetches the default plan (where isDefault is true) or creates it if non-existent.</action>
                <action>getPlansForContext(classId, roomId?): Fetches all plans (default and named) for the given context.</action>
                <action>createNewNamedPlan(name, classId, layout, roomId?): Creates a new, non-default plan, often cloning the layout from an existing plan.</action>
                <action>updatePlanLayout(planId, layoutData): The target for the auto-save mechanism.</action>
                <action>renamePlan(planId, newName)</action>
                <action>deletePlan(planId)</action>
            </actions_to_implement>
        </step>

        <step number="2" title="Implement Core Editor UI">
            <details>This is the main implementation task, focused on `components/editor/EditorHeader.tsx`.</details>
            <task>Implement the `Class` and `Room` (with `[Blank Canvas]` option) selection dropdowns.</task>
            <task>Implement the new central "Active Plan" dropdown. On initial load, it is populated by `getPlansForContext` and shows the default plan as active.</task>
            <task>The `+ Create New Plan...` option within the dropdown should trigger a dialog to get a name and then call the `createNewNamedPlan` action.</task>
            <task>Changing the selection in the dropdown should switch the `activePlanId` in the editor's state and reload the layout.</task>
        </step>

        <step number="3" title="Wire Up Editor Logic">
            <details>Modify the editor's main component and state (`useEditorState.ts`).</details>
            <task>On `Class` or `Room` selection, fetch the necessary plan data using the server actions.</task>
            <task>Ensure the auto-save mechanism uses the `activePlanId` from the state to call `updatePlanLayout`.</task>
        </step>

        <step number="4" title="Update the Settings Modal">
            <details>The modal's role is for global configuration and housekeeping, not the primary workflow.</details>
            <pane name="Profil-Setup">Remains for profile name and class teacher selection.</pane>
            <pane name="Daten-Manager">Remains for CRUD management of Students, Classes, and Rooms.</pane>
            <pane name="Gespeicherte Pläne">
                Add this new pane. It will display a list of ALL named (non-default) plans for the entire profile.
                This UI should allow users to `rename` or `delete` any of these plans, providing a central place for cleanup.
            </pane>
            <pane name="Gefahrenzone">Remains for deleting the profile.</pane>
        </step>
    </step_by_step_implementation>

    <testing_scenarios>
        <scenario>On selecting a Class/Room, the default plan loads and the "Active Plan" dropdown shows it.</scenario>
        <scenario>Creating a new plan makes it active, and auto-save applies to the new plan only.</scenario>
        <scenario>Switching back and forth between plans in the dropdown loads the correct layouts.</scenario>
        <scenario>Creating a room-independent (`[Blank Canvas]`) plan and editing it.</scenario>
        <scenario>Renaming and deleting plans from the "Gespeicherte Pläne" section in the settings modal and seeing the changes reflected in the editor dropdown.</scenario>
    </testing_scenarios>
</implementation_plan>
