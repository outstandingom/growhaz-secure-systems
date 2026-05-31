
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TimelineLogger.sol";
import "./AuthorizationRegistry.sol";
import "./DocumentStatusTracker.sol";

contract ProcessManager {
    TimelineLogger public timeline;
    AuthorizationRegistry public authRegistry;
    DocumentStatusTracker public docStatus;

    struct ProcessTemplate {
        address owner;          // organisation that owns this template
        string ipfsHash;        // JSON with steps, roles, etc.
        uint8 totalSteps;       // total number of steps (1‑based)
        bool active;
    }

    struct ProcessInstance {
        string templateId;
        string documentId;
        address documentOwner;  // user who initiated / owns the document
        uint8 currentStep;      // 0 = not started
        string status;          // "pending", "in-progress", "approved", "rejected"
        bool exists;
    }

    mapping(string => ProcessTemplate) public templates;
    mapping(bytes32 => ProcessInstance) public instances;
    mapping(bytes32 => mapping(uint8 => address)) public stepAssignees; // instanceId => step => assignee

    event ProcessTemplateCreated(string templateId, address owner, uint8 totalSteps, string ipfsHash);
    event InstanceStarted(bytes32 indexed instanceId, string templateId, string documentId, address documentOwner);
    event StepAssigned(bytes32 indexed instanceId, uint8 step, address assignee);
    event StepApproved(bytes32 indexed instanceId, uint8 step, address approver);
    event StepRejected(bytes32 indexed instanceId, uint8 step, address rejector, string reason);
    event InstanceCompleted(bytes32 indexed instanceId, string finalStatus);

    constructor(address _timeline, address _authRegistry, address _docStatus) {
        timeline = TimelineLogger(_timeline);
        authRegistry = AuthorizationRegistry(_authRegistry);
        docStatus = DocumentStatusTracker(_docStatus);
    }

    // ─── Template management ──────────────────────────────────

    function createTemplate(
        string calldata _templateId,
        string calldata _ipfsHash,
        uint8 _totalSteps
    ) external {
        require(!templates[_templateId].active, "Template already exists");
        require(_totalSteps > 0, "Steps must be > 0");
        templates[_templateId] = ProcessTemplate(msg.sender, _ipfsHash, _totalSteps, true);
        emit ProcessTemplateCreated(_templateId, msg.sender, _totalSteps, _ipfsHash);
    }

    // ─── Instance lifecycle ───────────────────────────────────

    /**
     * @notice Any user can start a process instance for a document they own.
     */
    function startInstance(
        string calldata _templateId,
        string calldata _documentId
    ) external {
        ProcessTemplate storage t = templates[_templateId];
        require(t.active, "Template does not exist");
        bytes32 instanceId = _getInstanceId(_templateId, _documentId);
        require(!instances[instanceId].exists, "Instance already exists");

        instances[instanceId] = ProcessInstance({
            templateId: _templateId,
            documentId: _documentId,
            documentOwner: msg.sender,
            currentStep: 0,
            status: "pending",
            exists: true
        });

        emit InstanceStarted(instanceId, _templateId, _documentId, msg.sender);
        timeline.record("process", _documentId, "instance_started", string.concat("Template: ", _templateId));
    }

    // ─── Step assignment (only template owner) ────────────────

    function assignStep(
        bytes32 _instanceId,
        uint8 _step,
        address _assignee
    ) external {
        ProcessInstance storage inst = instances[_instanceId];
        require(inst.exists, "Instance not found");
        require(_step == inst.currentStep + 1, "Invalid step order");
        require(_step <= templates[inst.templateId].totalSteps, "Step out of range");

        address org = templates[inst.templateId].owner;
        require(msg.sender == org, "Only template owner can assign");
        require(authRegistry.isAuthorised(_assignee, org, inst.templateId), "Employee not authorised for process");

        stepAssignees[_instanceId][_step] = _assignee;
        inst.currentStep = _step;
        inst.status = "in-progress";

        emit StepAssigned(_instanceId, _step, _assignee);
        timeline.record("process", inst.documentId, "step_assigned",
            string.concat("Step ", _uint2str(_step), " assigned to ", _addrToStr(_assignee)));
    }

    // ─── Step approval (only assignee) ─────────────────────────

    function approveStep(bytes32 _instanceId, uint8 _step) external {
        ProcessInstance storage inst = instances[_instanceId];
        require(inst.exists && inst.currentStep == _step, "Invalid step");
        require(stepAssignees[_instanceId][_step] == msg.sender, "Not your step");

        address org = templates[inst.templateId].owner;
        require(authRegistry.isAuthorised(msg.sender, org, inst.templateId), "Authorisation expired");

        emit StepApproved(_instanceId, _step, msg.sender);
        timeline.record("process", inst.documentId, "step_approved",
            string.concat("Step ", _uint2str(_step), " approved by ", _addrToStr(msg.sender)));

        // If final step, complete the instance
        if (_step == templates[inst.templateId].totalSteps) {
            inst.status = "approved";
            emit InstanceCompleted(_instanceId, "approved");
            timeline.record("process", inst.documentId, "completed", "All steps approved");
            docStatus.setStatus(inst.documentId, "approved");
        }
    }

    // ─── Step rejection (only assignee) ────────────────────────

    function rejectStep(bytes32 _instanceId, uint8 _step, string calldata _reason) external {
        ProcessInstance storage inst = instances[_instanceId];
        require(inst.exists && inst.currentStep == _step, "Invalid step");
        require(stepAssignees[_instanceId][_step] == msg.sender, "Not your step");

        address org = templates[inst.templateId].owner;
        require(authRegistry.isAuthorised(msg.sender, org, inst.templateId), "Authorisation expired");

        inst.status = "rejected";
        emit StepRejected(_instanceId, _step, msg.sender, _reason);
        timeline.record("process", inst.documentId, "step_rejected",
            string.concat("Step ", _uint2str(_step), " rejected by ", _addrToStr(msg.sender), ": ", _reason));
        docStatus.setStatus(inst.documentId, "rejected");
    }

    // ─── Helpers ──────────────────────────────────────────────

    function _getInstanceId(string memory _templateId, string memory _documentId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_templateId, _documentId));
    }

    function _uint2str(uint _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint j = _i;
        uint len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        while (_i != 0) {
            bstr[--len] = bytes1(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }

    function _addrToStr(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2 ** (8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 * i]     = _char(hi);
            s[2 * i + 1] = _char(lo);
        }
        return string(s);
    }

    function _char(bytes1 b) internal pure returns (bytes1) {
        return uint8(b) < 10 ? bytes1(uint8(b) + 0x30) : bytes1(uint8(b) + 0x57);
    }
}
