
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TimelineLogger.sol";

contract DocumentStatusTracker {
    TimelineLogger public timeline;
    mapping(string => string) public statuses;      // docId => "pending" | "in-review" | "approved" | "rejected"
    address public processManager;                 // address allowed to change status
    address public admin;

    event DocumentStatusChanged(string indexed docId, string newStatus, address updatedBy);

    constructor(address _timeline) {
        timeline = TimelineLogger(_timeline);
        admin = msg.sender;
    }

    modifier onlyProcessManager() {
        require(msg.sender == processManager, "Only ProcessManager");
        _;
    }

    function setProcessManager(address _pm) external {
        require(msg.sender == admin, "Admin only");
        processManager = _pm;
    }

    function setStatus(string calldata _docId, string calldata _newStatus) external onlyProcessManager {
        statuses[_docId] = _newStatus;
        emit DocumentStatusChanged(_docId, _newStatus, msg.sender);
        timeline.record("document", _docId, "status_changed", _newStatus);
    }
}
