// ── File Tree ────────────────────────────────────────────
// ── Agent ───────────────────────────────────────────────
export var AgentState;
(function (AgentState) {
    AgentState["Idle"] = "idle";
    AgentState["Thinking"] = "thinking";
    AgentState["Acting"] = "acting";
    AgentState["Error"] = "error";
    AgentState["WaitingApproval"] = "waiting-approval";
})(AgentState || (AgentState = {}));
