# Tabbed Workspace Reference

This app stays in vanilla HTML/CSS/JS. The structure below is the React-style component map for the implemented calculator shell.

## Component Hierarchy

- `IndustrialPlannerWorkspace`
- `WorkspaceHeader`
- `TargetDock`
- `WorkspaceTabs`
- `PlanTab`
- `NextActionsCard`
- `BottleneckCard`
- `MaterialsList`
- `ComponentsList`
- `DependenciesTab`
- `PipelineToggle`
- `PipelineView`
- `AdvancedTreeView`
- `DatasetDrawer`
- `FiltersDrawer`
- `ViewDrawer`
- `DataUploadModal`

## Example JSX

```jsx
function IndustrialPlannerWorkspace({ viewModel, uiState }) {
  return (
    <div className="workspace-shell">
      <WorkspaceHeader
        title="Frontier Industry Calculator"
        target={viewModel.header.targetName}
        progress={viewModel.header.progressPercent}
        eta={viewModel.header.etaLabel}
      />

      <TargetDock
        search={viewModel.search}
        selectedTarget={viewModel.selectedTarget}
        quantity={viewModel.quantity}
        recipeOptions={viewModel.recipeOptions}
      />

      <WorkspaceTabs activeTab={uiState.activeWorkspaceTab}>
        <PlanTab hidden={uiState.activeWorkspaceTab !== "plan"}>
          <NextActionsCard actions={viewModel.nextActions} />
          <BottleneckCard bottleneck={viewModel.bottleneck} />
          <MaterialsList rows={viewModel.materials} expanded={uiState.expandedLists.materials} />
          <ComponentsList rows={viewModel.components} expanded={uiState.expandedLists.components} />
        </PlanTab>

        <PipelineView hidden={uiState.activeWorkspaceTab !== "pipeline"} groups={viewModel.pipeline} />
        <AdvancedTreeView hidden={uiState.activeWorkspaceTab !== "tree"} treeMarkup={viewModel.treeMarkup} />
      </WorkspaceTabs>

      <DatasetDrawer open={uiState.openDrawer === "dataset"} dataset={viewModel.dataset} plan={viewModel.plan} />
      <FiltersDrawer open={uiState.openDrawer === "filters"} filters={viewModel.filters} presets={viewModel.presets} />
      <ViewDrawer open={uiState.openDrawer === "view"} viewSettings={viewModel.viewSettings} />
      <DataUploadModal open={uiState.isUploadModalOpen} />
    </div>
  );
}
```
