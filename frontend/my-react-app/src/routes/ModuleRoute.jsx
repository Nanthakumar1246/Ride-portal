
import React from "react";
import { useParams, useLocation } from "react-router-dom";
import WorkboardPage from "../pages/WorkboardPage";

import { fetchRisks, fetchRiskApi, createRiskApi, updateRiskApi, deleteRisksApi } from "../api/risksApi";
import { fetchIssues, fetchIssueApi, createIssueApi, updateIssueApi, deleteIssuesApi } from "../api/issuesApi";
import { fetchActions, fetchActionApi, createActionApi, updateActionApi, deleteActionsApi } from "../api/actionsApi";
import {
  fetchDependencies,
  fetchDependencyApi,
  createDependencyApi,
  updateDependencyApi,
  deleteDependenciesApi,
} from "../api/dependenciesApi";
import {
  fetchEscalations,
  fetchEscalationApi,
  createEscalationApi,
  updateEscalationApi,
  deleteEscalationsApi,
} from "../api/escalationsApi";
import {
  fetchAppreciations,
  fetchAppreciationApi,
  createAppreciationApi,
  updateAppreciationApi,
  deleteAppreciationsApi,
} from "../api/appreciationsApi";

import {
  risksFormConfig,
  issuesFormConfig,
  actionsFormConfig,
  dependenciesFormConfig,
  escalationsFormConfig,
  appreciationsFormConfig,
} from "../config/formConfig";

const moduleMap = {
  risks: {
    title: "Risks Workboard",
    fetchList: fetchRisks,
    fetchItem: fetchRiskApi,
    createItem: createRiskApi,
    updateItem: updateRiskApi,
    deleteItem: deleteRisksApi,
    formConfig: risksFormConfig,
  },
  issues: {
    title: "Issues Workboard",
    fetchList: fetchIssues,
    fetchItem: fetchIssueApi,
    createItem: createIssueApi,
    updateItem: updateIssueApi,
    deleteItem: deleteIssuesApi,
    formConfig: issuesFormConfig,
  },
  actions: {
    title: "Actions Workboard",
    fetchList: fetchActions,
    fetchItem: fetchActionApi,
    createItem: createActionApi,
    updateItem: updateActionApi,
    deleteItem: deleteActionsApi,
    formConfig: actionsFormConfig,
  },
  dependencies: {
    title: "Dependencies Workboard",
    fetchList: fetchDependencies,
    fetchItem: fetchDependencyApi,
    createItem: createDependencyApi,
    updateItem: updateDependencyApi,
    deleteItem: deleteDependenciesApi,
    formConfig: dependenciesFormConfig,
  },
  escalations: {
    title: "Escalations Workboard",
    fetchList: fetchEscalations,
    fetchItem: fetchEscalationApi,
    createItem: createEscalationApi,
    updateItem: updateEscalationApi,
    deleteItem: deleteEscalationsApi,
    formConfig: escalationsFormConfig,
  },
  appreciations: {
    title: "Appreciations Workboard",
    fetchList: fetchAppreciations,
    fetchItem: fetchAppreciationApi,
    createItem: createAppreciationApi,
    updateItem: updateAppreciationApi,
    deleteItem: deleteAppreciationsApi,
    formConfig: appreciationsFormConfig,
  },
};

const ModuleRoute = () => {
  const { moduleKey } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "view";

  const cfg = moduleMap[moduleKey];
  if (!cfg) return <div>Unknown module: {moduleKey}</div>;

  return (
    <WorkboardPage
      title={cfg.title}
      moduleKey={moduleKey}
      mode={mode}
      fetchList={cfg.fetchList}
      fetchItem={cfg.fetchItem}
      
      createItem={mode === "edit" ? cfg.createItem : null}
      
      updateItem={cfg.updateItem}
      deleteItem={cfg.deleteItem}
      formConfig={cfg.formConfig}
    />
  );
};

export default ModuleRoute;
