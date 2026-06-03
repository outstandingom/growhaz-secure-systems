// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TimelineLogger.sol";
import "./AuthorizationRegistry.sol";

/**
 * StepManager
 * -----------
 * Dynamic, per-instance step tracking for any document/process.
 *
 * Why a separate contract?
 *   - ProcessManager uses a fixed `totalSteps` count taken from a template.
 *   - Real workflows need to ADD / REORDER / VERIFY steps at runtime
 *     (e.g. an insurance claim may need an extra inspection step).
 *
 * Each step records:
 *   - title + description (what)
 *   - assignee (who should do it)
 *   - actor + completedAt (who actually did it, when)
 *   - evidenceHash (IPFS / Filecoin CID of supporting docs)
 *   - verifier + verifiedAt + verificationNote (who confirmed it)
 *   - status: Pending -> InProgress -> Completed -> Verified | Rejected
 *
 * Instance is identified by `keccak256(entityType, entityId)` so it works
 * for documents, processes, claims, anything.
 */
contract StepManager {
    TimelineLogger public timeline;
    AuthorizationRegistry public authRegistry;

    enum StepStatus { Pending, InProgress, Completed, Verified, Rejected }

    struct Step {
        uint256 id;
        string title;
        string description;
        address assignee;
        address actor;
        address verifier;
        uint256 createdAt;
        uint256 completedAt;
        uint256 verifiedAt;
        string evidenceHash;       // IPFS/Filecoin CID
        string completionNote;
        string verificationNote;
        StepStatus status;
        bool exists;
    }

    struct Instance {
        string entityType;          // "document" | "process" | "claim" | ...
        string entityId;
        address owner;              // who initiated the workflow
        address organisation;       // org that governs verification (optional)
        string processType;         // used with AuthorizationRegistry
        uint256 stepCount;
        bool exists;
    }

    // instanceKey = keccak256(entityType, entityId)
    mapping(bytes32 => Instance) public instances;
    mapping(bytes32 => mapping(uint256 => Step)) public steps;

    event InstanceCreated(bytes32 indexed instanceKey, string entityType, string entityId, address owner, address organisation);
    event StepAdded(bytes32 indexed instanceKey, uint256 indexed stepId, string title, address assignee);
    event StepStarted(bytes32 indexed instanceKey, uint256 indexed stepId, address actor);
    event StepCompleted(bytes32 indexed instanceKey, uint256 indexed stepId, address actor, string evidenceHash, string note);
    event StepVerified(bytes32 indexed instanceKey, uint256 indexed stepId, address verifier, string note);
    event StepRejected(bytes32 indexed instanceKey, uint256 indexed stepId, address verifier, string reason);

    constructor(address _timeline, address _authRegistry) {
        timeline = TimelineLogger(_timeline);
        authRegistry = AuthorizationRegistry(_authRegistry);
    }

    // ── Instance lifecycle ──────────────────────────────────────

    function createInstance(
        string calldata _entityType,
        string calldata _entityId,
        address _organisation,
        string calldata _processType
    ) external returns (bytes32 key) {
        key = _key(_entityType, _entityId);
        require(!instances[key].exists, "Instance exists");
        instances[key] = Instance({
            entityType: _entityType,
            entityId: _entityId,
            owner: msg.sender,
            organisation: _organisation,
            processType: _processType,
            stepCount: 0,
            exists: true
        });
        emit InstanceCreated(key, _entityType, _entityId, msg.sender, _organisation);
        _log(_entityType, _entityId, "instance_created", "Step instance created");
    }

    // ── Dynamic step authoring ──────────────────────────────────

    /**
     * Anyone in the instance (owner OR the organisation) can append a step.
     * This makes the workflow extensible at runtime.
     */
    function addStep(
        bytes32 _instanceKey,
        string calldata _title,
        string calldata _description,
        address _assignee
    ) external returns (uint256 stepId) {
        Instance storage inst = instances[_instanceKey];
        require(inst.exists, "Instance not found");
        require(msg.sender == inst.owner || msg.sender == inst.organisation, "Not allowed");

        stepId = ++inst.stepCount;
        steps[_instanceKey][stepId] = Step({
            id: stepId,
            title: _title,
            description: _description,
            assignee: _assignee,
            actor: address(0),
            verifier: address(0),
            createdAt: block.timestamp,
            completedAt: 0,
            verifiedAt: 0,
            evidenceHash: "",
            completionNote: "",
            verificationNote: "",
            status: StepStatus.Pending,
            exists: true
        });
        emit StepAdded(_instanceKey, stepId, _title, _assignee);
        _log(inst.entityType, inst.entityId, "step_added", _title);
    }

    // ── Step execution ──────────────────────────────────────────

    function startStep(bytes32 _instanceKey, uint256 _stepId) external {
        Step storage s = steps[_instanceKey][_stepId];
        require(s.exists, "Step not found");
        require(s.status == StepStatus.Pending, "Bad status");
        require(s.assignee == address(0) || s.assignee == msg.sender, "Not assignee");
        s.actor = msg.sender;
        s.status = StepStatus.InProgress;
        emit StepStarted(_instanceKey, _stepId, msg.sender);
        Instance storage inst = instances[_instanceKey];
        _log(inst.entityType, inst.entityId, "step_started", s.title);
    }

    function completeStep(
        bytes32 _instanceKey,
        uint256 _stepId,
        string calldata _evidenceHash,
        string calldata _note
    ) external {
        Step storage s = steps[_instanceKey][_stepId];
        require(s.exists, "Step not found");
        require(s.status == StepStatus.InProgress || s.status == StepStatus.Pending, "Bad status");
        require(s.assignee == address(0) || s.assignee == msg.sender, "Not assignee");

        s.actor = msg.sender;
        s.completedAt = block.timestamp;
        s.evidenceHash = _evidenceHash;
        s.completionNote = _note;
        s.status = StepStatus.Completed;

        emit StepCompleted(_instanceKey, _stepId, msg.sender, _evidenceHash, _note);
        Instance storage inst = instances[_instanceKey];
        _log(inst.entityType, inst.entityId, "step_completed", s.title);
    }

    // ── Verification ────────────────────────────────────────────

    /**
     * Verifier must be authorised by the instance's organisation for the
     * declared processType (if organisation set). Otherwise owner verifies.
     */
    function verifyStep(bytes32 _instanceKey, uint256 _stepId, string calldata _note) external {
        Step storage s = steps[_instanceKey][_stepId];
        Instance storage inst = instances[_instanceKey];
        require(s.exists, "Step not found");
        require(s.status == StepStatus.Completed, "Not completed");
        _requireVerifier(inst);

        s.verifier = msg.sender;
        s.verifiedAt = block.timestamp;
        s.verificationNote = _note;
        s.status = StepStatus.Verified;

        emit StepVerified(_instanceKey, _stepId, msg.sender, _note);
        _log(inst.entityType, inst.entityId, "step_verified", s.title);
    }

    function rejectStep(bytes32 _instanceKey, uint256 _stepId, string calldata _reason) external {
        Step storage s = steps[_instanceKey][_stepId];
        Instance storage inst = instances[_instanceKey];
        require(s.exists, "Step not found");
        require(s.status == StepStatus.Completed || s.status == StepStatus.InProgress, "Bad status");
        _requireVerifier(inst);

        s.verifier = msg.sender;
        s.verifiedAt = block.timestamp;
        s.verificationNote = _reason;
        s.status = StepStatus.Rejected;

        emit StepRejected(_instanceKey, _stepId, msg.sender, _reason);
        _log(inst.entityType, inst.entityId, "step_rejected", _reason);
    }

    // ── Views ───────────────────────────────────────────────────

    function getStep(bytes32 _key, uint256 _stepId) external view returns (Step memory) {
        return steps[_key][_stepId];
    }

    function getStepCount(bytes32 _key) external view returns (uint256) {
        return instances[_key].stepCount;
    }

    // ── Internals ───────────────────────────────────────────────

    function _requireVerifier(Instance storage inst) internal view {
        if (inst.organisation == address(0)) {
            require(msg.sender == inst.owner, "Only owner can verify");
        } else {
            require(
                authRegistry.isAuthorised(msg.sender, inst.organisation, inst.processType),
                "Verifier not authorised"
            );
        }
    }

    function _key(string memory _entityType, string memory _entityId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_entityType, "::", _entityId));
    }

    function _log(string memory _entityType, string memory _entityId, string memory _action, string memory _desc) internal {
        try timeline.record(_entityType, _entityId, _action, _desc) {} catch {}
    }
}
